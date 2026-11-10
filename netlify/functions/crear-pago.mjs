/* ==========================================================
   HAMBURGUELO · Función de servidor (Netlify Function)
   Crea una "preferencia" de Checkout Pro en Mercado Pago y devuelve
   el link de pago (init_point).

   POR QUÉ EXISTE ESTE ARCHIVO:
   - El Access Token de Mercado Pago es secreto: solo puede vivir acá,
     en el servidor, como variable de entorno (MP_ACCESS_TOKEN).
   - Los PRECIOS se calculan acá, nunca se confía en los que manda el
     navegador. Si alguien modifica el JavaScript de la página para
     mandar "precio: 1", este código lo ignora.

   El navegador solo manda: [{ id: "clasica", cantidad: 2 }, ...]
   ========================================================== */

// Catálogo confiable del servidor. Tiene que coincidir con PRODUCTOS de script.js.
// Si cambiás un precio en script.js, cambialo también acá.
const CATALOGO = {
  clasica: { titulo: "La Clásica del Barrio", precio: 380 },
  doble:   { titulo: "Doble Derrame",         precio: 520 },
  bbq:     { titulo: "Bruta BBQ",             precio: 470 },
  picante: { titulo: "Fuego Lento",           precio: 440 }
};

const CANTIDAD_MAXIMA = 20; // límite razonable por producto

function responder(datos, estado) {
  return new Response(JSON.stringify(datos), {
    status: estado || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

// ¿La URL es pública y con HTTPS? (Mercado Pago rechaza "auto_return" con localhost)
function esUrlPublica(url) {
  return /^https:\/\//i.test(url) &&
         !/^https:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(url);
}

export default async (req) => {
  if (req.method !== "POST") {
    return responder({ error: "Método no permitido" }, 405);
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return responder({ error: "Falta configurar MP_ACCESS_TOKEN en el servidor." }, 500);
  }

  // 1. Leer el pedido del navegador
  let pedido;
  try {
    pedido = await req.json();
  } catch (error) {
    return responder({ error: "El pedido no es un JSON válido." }, 400);
  }
  if (!pedido || !Array.isArray(pedido.items) || pedido.items.length === 0) {
    return responder({ error: "El carrito está vacío." }, 400);
  }

  // 2. Armar los ítems usando SOLO el catálogo del servidor
  const items = [];
  for (const linea of pedido.items) {
    const producto = Object.prototype.hasOwnProperty.call(CATALOGO, linea && linea.id)
      ? CATALOGO[linea.id]
      : null;
    const cantidad = linea ? linea.cantidad : null;

    if (!producto || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAXIMA) {
      return responder({ error: "El pedido tiene un producto o una cantidad inválida." }, 400);
    }
    items.push({
      title: producto.titulo,
      quantity: cantidad,
      unit_price: producto.precio,
      currency_id: "UYU"
    });
  }

  // 3. Dirección base del sitio. Netlify define URL con la dirección pública del sitio.
  const baseUrl = (process.env.APP_URL || process.env.URL || "http://localhost:8888").replace(/\/$/, "");

  const cuerpo = {
    items: items,
    back_urls: {
      success: baseUrl + "/?pago=exitoso#carrito",
      failure: baseUrl + "/?pago=fallido#carrito",
      pending: baseUrl + "/?pago=pendiente#carrito"
    },
    external_reference: "hamburguelo-" + Date.now(),
    statement_descriptor: "HAMBURGUELO"
  };
  // auto_return solo funciona con una URL pública con HTTPS
  if (esUrlPublica(baseUrl)) {
    cuerpo.auto_return = "approved";
  }

  // 4. Pedirle a Mercado Pago que cree la preferencia
  try {
    const respuesta = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cuerpo)
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.init_point) {
      console.error("Mercado Pago rechazó la preferencia:", respuesta.status, datos);
      return responder({ error: "Mercado Pago no pudo crear el pago." }, 502);
    }

    // Siempre usamos init_point: Mercado Pago ya no tiene entorno sandbox con otra dirección
    return responder({ url: datos.init_point });
  } catch (error) {
    console.error("Error al llamar a Mercado Pago:", error);
    return responder({ error: "No se pudo conectar con Mercado Pago." }, 502);
  }
};
