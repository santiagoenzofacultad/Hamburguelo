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
   - Los DATOS DEL CLIENTE también se revisan acá: la validación del
     navegador sirve para avisarle al cliente, pero cualquiera puede saltearla.

   El navegador manda:
     { items: [{ id: "clasica", cantidad: 2 }], cliente: { tipo, nombre, ... } }
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

// Devuelve un texto limpio y recortado (o "" si no era texto)
function limpiarTexto(valor, largoMaximo) {
  return typeof valor === "string" ? valor.trim().slice(0, largoMaximo) : "";
}

// Revisa los datos del cliente. Devuelve { ok: true, cliente } o { ok: false, error }
function validarCliente(c) {
  if (!c || typeof c !== "object") {
    return { ok: false, error: "Faltan los datos del pedido." };
  }

  const tipo = c.tipo === "delivery" || c.tipo === "retiro" ? c.tipo : null;
  if (!tipo) return { ok: false, error: "Elegí si es delivery o retiro." };

  const nombre = limpiarTexto(c.nombre, 60);
  const apellido = limpiarTexto(c.apellido, 60);
  if (!nombre || !apellido) return { ok: false, error: "Faltan el nombre y el apellido." };

  const celular = limpiarTexto(c.celular, 30);
  const digitos = celular.replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 15) {
    return { ok: false, error: "El número de celular no es válido." };
  }

  let direccion = "";
  let referencias = "";
  if (tipo === "delivery") {
    direccion = limpiarTexto(c.direccion, 150);
    referencias = limpiarTexto(c.referencias, 200);
    if (direccion.length < 5) return { ok: false, error: "Falta la dirección de entrega." };
  }

  return { ok: true, cliente: { tipo, nombre, apellido, celular, digitos, direccion, referencias } };
}

// Deja el número listo para Mercado Pago: sin el 0 inicial ni el 598
function numeroNacional(digitos) {
  let numero = digitos;
  if (numero.startsWith("598") && numero.length > 9) numero = numero.slice(3);
  if (numero.startsWith("0")) numero = numero.slice(1);
  return numero;
}

async function crearPreferencia(token, cuerpo) {
  const respuesta = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(cuerpo)
  });
  const datos = await respuesta.json();
  return { respuesta, datos };
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

  // 3. Revisar los datos del cliente (delivery o retiro)
  const validacion = validarCliente(pedido.cliente);
  if (!validacion.ok) {
    return responder({ error: validacion.error }, 400);
  }
  const cliente = validacion.cliente;

  // 4. Dirección base del sitio. Netlify define URL con la dirección pública del sitio.
  const baseUrl = (process.env.APP_URL || process.env.URL || "http://localhost:8888").replace(/\/$/, "");

  const cuerpoBase = {
    items: items,
    back_urls: {
      success: baseUrl + "/?pago=exitoso#carrito",
      failure: baseUrl + "/?pago=fallido#carrito",
      pending: baseUrl + "/?pago=pendiente#carrito"
    },
    external_reference: "hamburguelo-" + cliente.tipo + "-" + Date.now(),
    statement_descriptor: "HAMBURGUELO"
  };
  // auto_return solo funciona con una URL pública con HTTPS
  if (esUrlPublica(baseUrl)) {
    cuerpoBase.auto_return = "approved";
  }

  // Datos del cliente dentro del pago, para verlos después en el panel de Mercado Pago.
  // Estos campos existen en la API, pero sus tipos exactos no están confirmados,
  // por eso hay un plan B más abajo.
  const cuerpoConCliente = Object.assign({}, cuerpoBase, {
    payer: {
      name: cliente.nombre,
      surname: cliente.apellido,
      phone: { number: Number(numeroNacional(cliente.digitos)) }
    }
  });
  if (cliente.tipo === "delivery") {
    cuerpoConCliente.shipments = {
      receiver_address: { street_name: cliente.direccion, country_name: "Uruguay" }
    };
  }

  // 5. Pedirle a Mercado Pago que cree la preferencia
  try {
    let { respuesta, datos } = await crearPreferencia(token, cuerpoConCliente);

    // PLAN B: si Mercado Pago rechaza los datos extra del cliente, reintentamos sin ellos
    // para que el cliente igual pueda pagar. El negocio igual recibe los datos por WhatsApp.
    if (!respuesta.ok && respuesta.status === 400) {
      console.warn("Mercado Pago rechazó los datos del cliente, reintentando sin ellos:", datos);
      ({ respuesta, datos } = await crearPreferencia(token, cuerpoBase));
    }

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
