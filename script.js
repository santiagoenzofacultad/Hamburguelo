/* ==========================================================
   HAMBURGUELO · Lógica de la página
   Qué hace este archivo:
   1. Guarda los datos de los productos y la configuración del pago.
   2. Dibuja las tarjetas del menú.
   3. Maneja el carrito (agregar, sumar, restar, quitar, total).
   4. Guarda el carrito en el navegador para que no se pierda al recargar.
   5. Se encarga del botón "Pagar", del menú en celular y del formulario.
   ========================================================== */


/* ==========================================================
   1. CONFIGURACIÓN DEL PAGO
   ----------------------------------------------------------
   Hay dos formas de pagar:

   A) MERCADO PAGO (Checkout Pro)
      El navegador le manda el carrito a una función de servidor
      (netlify/functions/crear-pago.mjs). Esa función, con el Access Token
      secreto, le pide a Mercado Pago que cree el pago con el total real y
      devuelve un link. Después redirigimos al cliente a ese link.
      El Access Token NO va en este archivo: se carga en Netlify como
      variable de entorno (MP_ACCESS_TOKEN).

   B) WHATSAPP
      Arma un mensaje con el pedido, el total y el método de pago elegido,
      y abre WhatsApp. Cambiá el número por el tuyo.
   ========================================================== */
const CONFIG_PAGO = {
  // Dirección de la función de servidor en Netlify
  funcionMercadoPago: "/.netlify/functions/crear-pago",

  // REEMPLAZAR POR TU NÚMERO (formato internacional, sin + ni espacios). Ej.: 598 + 9 dígitos
  whatsappNumero: "59898745641"
};


/* ==========================================================
   2. PRODUCTOS
   ----------------------------------------------------------
   Para agregar o editar una hamburguesa, solo se modifica este array.
   - id:     identificador único (sin espacios).
   - precio: en pesos uruguayos, solo el número.
   - color:  fondo del bloque de imagen.
   - emoji:  se muestra en lugar de la foto.
   - imagen: opcional. Si ponés una ruta (por ejemplo "img/clasica.jpg"),
             se usa la foto en vez del emoji.
   ========================================================== */
const PRODUCTOS = [
  {
    id: "clasica",
    nombre: "La Clásica del Barrio",
    descripcion: "La de siempre, bien hecha: carne jugosa, cheddar y frescura en cada mordida.",
    ingredientes: ["Carne 150 g", "Cheddar", "Lechuga", "Tomate", "Pan de papa"],
    precio: 380,
    color: "#F5B81C",
    emoji: "🍔",
    imagen: ""
  },
  {
    id: "doble",
    nombre: "Doble Derrame",
    descripcion: "Dos carnes, doble queso y cero piedad. El cheddar se derrite hasta el plato.",
    ingredientes: ["Doble carne", "Doble cheddar", "Pickles", "Salsa de la casa", "Pan de papa"],
    precio: 520,
    color: "#E9962B",
    emoji: "🧀",
    imagen: ""
  },
  {
    id: "bbq",
    nombre: "Bruta BBQ",
    descripcion: "Barbacoa ahumada y cebolla crocante para los que van por todo.",
    ingredientes: ["Carne 150 g", "Salsa BBQ", "Cebolla crocante", "Panceta", "Cheddar"],
    precio: 470,
    color: "#C9702B",
    emoji: "🥓",
    imagen: ""
  },
  {
    id: "picante",
    nombre: "Fuego Lento",
    descripcion: "Picante con onda: jalapeños y una salsa que se hace sentir, pero sin pasarse.",
    ingredientes: ["Carne 150 g", "Jalapeños", "Salsa picante", "Queso pepper jack", "Lechuga"],
    precio: 440,
    color: "#E3573B",
    emoji: "🌶️",
    imagen: ""
  }
];


/* ==========================================================
   3. ESTADO DEL CARRITO Y GUARDADO EN EL NAVEGADOR
   ----------------------------------------------------------
   El carrito es un array de objetos: [{ id: "clasica", cantidad: 2 }, ...]
   Se guarda en localStorage. Como puede fallar (modo privado, datos
   bloqueados...), TODO acceso va envuelto en try/catch para que la
   página nunca se rompa.
   ========================================================== */
const CLAVE_GUARDADO = "hamburguelo_carrito";
let carrito = cargarCarrito();

function cargarCarrito() {
  try {
    const guardado = localStorage.getItem(CLAVE_GUARDADO);
    if (!guardado) return [];
    const datos = JSON.parse(guardado);
    if (!Array.isArray(datos)) return [];
    // Nos quedamos solo con ítems válidos: que el producto exista y la cantidad sea un número positivo
    return datos.filter(function (item) {
      return PRODUCTOS.some(function (p) { return p.id === item.id; }) &&
             Number.isInteger(item.cantidad) && item.cantidad > 0;
    });
  } catch (error) {
    return []; // si algo falla, arrancamos con el carrito vacío
  }
}

function guardarCarrito() {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(carrito));
  } catch (error) {
    // Si no se puede guardar, el carrito sigue funcionando mientras la página esté abierta
  }
}


/* ==========================================================
   4. FUNCIONES AUXILIARES
   ========================================================== */

// Da formato de dinero: 380 -> "$ 380"
const formatoDinero = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 0
});

function buscarProducto(id) {
  return PRODUCTOS.find(function (p) { return p.id === id; });
}

function calcularTotal() {
  return carrito.reduce(function (suma, item) {
    return suma + buscarProducto(item.id).precio * item.cantidad;
  }, 0);
}

function contarUnidades() {
  return carrito.reduce(function (suma, item) { return suma + item.cantidad; }, 0);
}

// Aviso flotante breve
let temporizadorToast;
function mostrarToast(texto) {
  const toast = document.getElementById("toast");
  toast.textContent = texto;
  toast.classList.add("toast--visible");
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(function () {
    toast.classList.remove("toast--visible");
  }, 2200);
}


/* ==========================================================
   5. DIBUJAR EL MENÚ
   ----------------------------------------------------------
   Los datos vienen del array PRODUCTOS (que escribimos nosotros),
   por eso es seguro armarlos con plantillas de texto.
   ========================================================== */
function dibujarMenu() {
  const contenedor = document.getElementById("menu-grilla");

  contenedor.innerHTML = PRODUCTOS.map(function (p) {
    // Si el producto tiene foto, se usa; si no, un bloque de color con emoji
    const bloqueImagen = p.imagen
      ? '<img src="' + p.imagen + '" alt="' + p.nombre + '" loading="lazy">'
      : '<span role="img" aria-label="' + p.nombre + '">' + p.emoji + "</span>";

    const ingredientes = p.ingredientes.map(function (i) {
      return "<li>" + i + "</li>";
    }).join("");

    return (
      '<article class="tarjeta">' +
        '<div class="tarjeta__imagen" style="background:' + p.color + '">' + bloqueImagen + "</div>" +
        '<div class="tarjeta__cuerpo">' +
          "<h3>" + p.nombre + "</h3>" +
          "<p>" + p.descripcion + "</p>" +
          '<ul class="tarjeta__ingredientes">' + ingredientes + "</ul>" +
          '<div class="tarjeta__pie">' +
            '<span class="tarjeta__precio">' + formatoDinero.format(p.precio) + "</span>" +
            '<button type="button" class="btn btn--secundario" data-agregar="' + p.id + '" ' +
              'aria-label="Agregar ' + p.nombre + ' al carrito">Agregar</button>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }).join("");
}


/* ==========================================================
   6. ACCIONES DEL CARRITO
   ========================================================== */
function agregarAlCarrito(id) {
  const existente = carrito.find(function (item) { return item.id === id; });
  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({ id: id, cantidad: 1 });
  }
  guardarCarrito();
  dibujarCarrito();
  mostrarToast("✅ " + buscarProducto(id).nombre + " agregada al carrito");

  // Animación del contador
  const chip = document.querySelector(".carrito-chip");
  chip.classList.remove("carrito-chip--salto");
  void chip.offsetWidth; // truco para poder repetir la animación
  chip.classList.add("carrito-chip--salto");
}

function cambiarCantidad(id, cambio) {
  const item = carrito.find(function (i) { return i.id === id; });
  if (!item) return;
  item.cantidad += cambio;
  // Si llega a 0, se quita del carrito
  if (item.cantidad <= 0) {
    quitarDelCarrito(id);
    return;
  }
  guardarCarrito();
  dibujarCarrito();
}

function quitarDelCarrito(id) {
  carrito = carrito.filter(function (item) { return item.id !== id; });
  guardarCarrito();
  dibujarCarrito();
}

function vaciarCarrito() {
  carrito = [];
  guardarCarrito();
  dibujarCarrito();
}


/* ==========================================================
   7. DIBUJAR EL CARRITO
   ----------------------------------------------------------
   Cada vez que algo cambia, se vuelve a dibujar todo el carrito
   y se actualiza el contador del encabezado. Es simple y confiable.
   ========================================================== */
function dibujarCarrito() {
  const lista = document.getElementById("carrito-lista");
  const vacio = document.getElementById("carrito-vacio");
  const pie = document.getElementById("carrito-pie");
  const total = document.getElementById("carrito-total");
  const contador = document.getElementById("contador-carrito");

  contador.textContent = contarUnidades();

  // Carrito vacío: mostramos el mensaje amable y ocultamos lo demás
  if (carrito.length === 0) {
    vacio.hidden = false;
    pie.hidden = true;
    lista.innerHTML = "";
    return;
  }

  vacio.hidden = true;
  pie.hidden = false;

  lista.innerHTML = carrito.map(function (item) {
    const p = buscarProducto(item.id);
    const subtotal = p.precio * item.cantidad;
    return (
      '<li class="carrito__item">' +
        '<span class="carrito__emoji" style="background:' + p.color + '" aria-hidden="true">' + p.emoji + "</span>" +
        "<div>" +
          '<div class="carrito__nombre">' + p.nombre + "</div>" +
          '<div class="carrito__unitario">' + formatoDinero.format(p.precio) + " c/u</div>" +
        "</div>" +
        '<div class="carrito__controles">' +
          '<div class="cantidad" role="group" aria-label="Cantidad de ' + p.nombre + '">' +
            '<button type="button" data-restar="' + p.id + '" aria-label="Restar una ' + p.nombre + '">−</button>' +
            '<span aria-live="polite">' + item.cantidad + "</span>" +
            '<button type="button" data-sumar="' + p.id + '" aria-label="Sumar una ' + p.nombre + '">+</button>' +
          "</div>" +
          '<span class="carrito__subtotal">' + formatoDinero.format(subtotal) + "</span>" +
          '<button type="button" class="carrito__quitar" data-quitar="' + p.id + '" aria-label="Quitar ' + p.nombre + ' del carrito">Quitar</button>' +
        "</div>" +
      "</li>"
    );
  }).join("");

  total.textContent = formatoDinero.format(calcularTotal());
}


/* ==========================================================
   8. BOTÓN "PAGAR"
   ========================================================== */
// --- Datos del pedido (delivery o retiro) ---

// Muestra u oculta los campos de dirección según el tipo de entrega elegido
function configurarTipoEntrega() {
  const radios = document.querySelectorAll('input[name="tipo-entrega"]');
  const camposDelivery = document.getElementById("campos-delivery");

  function actualizar() {
    const tipo = document.querySelector('input[name="tipo-entrega"]:checked').value;
    camposDelivery.hidden = (tipo !== "delivery");
  }

  radios.forEach(function (radio) { radio.addEventListener("change", actualizar); });
  actualizar();
}

// Lee y valida los datos del formulario.
// Devuelve un objeto con los datos, o null si falta algo (y avisa en pantalla).
// OJO: esta validación es solo para ayudar al cliente. El servidor la repite.
function leerDatosPedido() {
  const aviso = document.getElementById("aviso-datos");
  const campos = {
    nombre: document.getElementById("dato-nombre"),
    apellido: document.getElementById("dato-apellido"),
    celular: document.getElementById("dato-celular"),
    direccion: document.getElementById("dato-direccion"),
    referencias: document.getElementById("dato-referencias")
  };

  // Limpiamos errores anteriores
  aviso.textContent = "";
  Object.keys(campos).forEach(function (clave) { campos[clave].removeAttribute("aria-invalid"); });

  const tipo = document.querySelector('input[name="tipo-entrega"]:checked').value;
  const datos = {
    tipo: tipo,
    nombre: campos.nombre.value.trim(),
    apellido: campos.apellido.value.trim(),
    celular: campos.celular.value.trim(),
    direccion: tipo === "delivery" ? campos.direccion.value.trim() : "",
    referencias: tipo === "delivery" ? campos.referencias.value.trim() : ""
  };

  // Marca el campo con problema, muestra el mensaje y lleva el cursor ahí
  function fallar(campo, mensaje) {
    campo.setAttribute("aria-invalid", "true");
    aviso.textContent = mensaje;
    campo.focus();
    return null;
  }

  if (!datos.nombre) return fallar(campos.nombre, "Escribí tu nombre.");
  if (!datos.apellido) return fallar(campos.apellido, "Escribí tu apellido.");

  const digitos = datos.celular.replace(/\D/g, ""); // nos quedamos solo con los números
  if (digitos.length < 8 || digitos.length > 15) {
    return fallar(campos.celular, "Revisá el celular: tiene que tener entre 8 y 15 números.");
  }
  if (tipo === "delivery" && datos.direccion.length < 5) {
    return fallar(campos.direccion, "Escribí la dirección de entrega (calle y número).");
  }

  return datos;
}

// Texto con los datos del cliente, para el mensaje de WhatsApp
function textoDatosPedido(datos) {
  const lineas = [
    "Tipo de pedido: " + (datos.tipo === "delivery" ? "Delivery (sin costo)" : "Retiro en el local"),
    "Nombre: " + datos.nombre + " " + datos.apellido,
    "Celular: " + datos.celular
  ];
  if (datos.tipo === "delivery") {
    lineas.push("Dirección: " + datos.direccion);
    if (datos.referencias) lineas.push("Para encontrar la casa: " + datos.referencias);
  }
  return lineas.join("\n");
}

// Texto con la lista de productos. "items" es un array de { id, cantidad }
function textoItems(items) {
  return items.map(function (item) {
    const p = buscarProducto(item.id);
    return "• " + item.cantidad + " x " + p.nombre + " (" + formatoDinero.format(p.precio * item.cantidad) + ")";
  }).join("\n");
}

function abrirWhatsApp(mensaje) {
  const url = "https://wa.me/" + CONFIG_PAGO.whatsappNumero + "?text=" + encodeURIComponent(mensaje);
  window.open(url, "_blank", "noopener");
}

// Guardamos el pedido antes de ir a Mercado Pago, para poder mandarlo por WhatsApp al volver
const CLAVE_PEDIDO_PENDIENTE = "hamburguelo_pedido_pendiente";

function guardarPedidoPendiente(pedido) {
  try { localStorage.setItem(CLAVE_PEDIDO_PENDIENTE, JSON.stringify(pedido)); } catch (error) { /* sin guardado */ }
}
function leerPedidoPendiente() {
  try {
    const guardado = localStorage.getItem(CLAVE_PEDIDO_PENDIENTE);
    return guardado ? JSON.parse(guardado) : null;
  } catch (error) { return null; }
}
function borrarPedidoPendiente() {
  try { localStorage.removeItem(CLAVE_PEDIDO_PENDIENTE); } catch (error) { /* nada */ }
}


// --- Opción A: Mercado Pago ---
async function pagarMercadoPago(evento) {
  evento.preventDefault(); // el botón está dentro de un <form>: evitamos que recargue la página

  const aviso = document.getElementById("aviso-pago");
  const boton = document.getElementById("btn-mercadopago");
  aviso.textContent = "";

  if (carrito.length === 0) return;

  // Primero validamos los datos del pedido. Si falta algo, no seguimos.
  const cliente = leerDatosPedido();
  if (!cliente) return;

  // Solo mandamos ids y cantidades. Los precios los calcula el servidor.
  const pedido = carrito.map(function (item) {
    return { id: item.id, cantidad: item.cantidad };
  });

  boton.disabled = true;
  boton.textContent = "Conectando con Mercado Pago…";

  try {
    const respuesta = await fetch(CONFIG_PAGO.funcionMercadoPago, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: pedido, cliente: cliente })
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.url) {
      throw new Error(datos.error || "No se pudo crear el pago.");
    }

    // Guardamos el pedido para mandarlo por WhatsApp cuando el cliente vuelva
    guardarPedidoPendiente({ items: pedido, total: calcularTotal(), cliente: cliente });

    // Llevamos al cliente a la página de pago de Mercado Pago
    window.location.href = datos.url;
  } catch (error) {
    aviso.textContent = "No pudimos iniciar el pago con Mercado Pago. Probá de nuevo en un momento. " +
                        "(Si abriste el archivo directo desde tu compu, esta opción solo funciona en Netlify.)";
    boton.disabled = false;
    boton.textContent = "Pagar con Mercado Pago";
  }
}

// --- Opción B: WhatsApp ---
function pagarWhatsApp() {
  const aviso = document.getElementById("aviso-pago");
  aviso.textContent = "";

  if (carrito.length === 0) return;

  const cliente = leerDatosPedido();
  if (!cliente) return;

  const metodo = document.getElementById("metodo-whatsapp").value;

  const mensaje = "Hola Hamburguelo! Quiero hacer este pedido:\n" + textoItems(carrito) +
                  "\n\nTotal: " + formatoDinero.format(calcularTotal()) +
                  "\nMétodo de pago: " + metodo +
                  "\n\n" + textoDatosPedido(cliente);

  abrirWhatsApp(mensaje);
}

// --- Después de pagar con Mercado Pago: avisarle el pedido al negocio por WhatsApp ---
function enviarPedidoConfirmadoPorWhatsApp() {
  const pendiente = leerPedidoPendiente();
  if (!pendiente) return;

  const mensaje = "Hola Hamburguelo! Ya pagué mi pedido con Mercado Pago:\n" + textoItems(pendiente.items) +
                  "\n\nTotal: " + formatoDinero.format(pendiente.total) +
                  "\nMétodo de pago: Mercado Pago" +
                  "\n\n" + textoDatosPedido(pendiente.cliente);

  abrirWhatsApp(mensaje);
  borrarPedidoPendiente();
  document.getElementById("pago-confirmado").hidden = true;
}

// Qué hacer cuando el cliente vuelve de Mercado Pago (la página recibe ?pago=...)
// OJO: la dirección de vuelta se puede escribir a mano, así que esto es solo informativo.
// El estado real del pago lo confirma el servidor de Mercado Pago (ver webhooks).
function mostrarResultadoDePago() {
  const parametros = new URLSearchParams(window.location.search);
  const resultado = parametros.get("pago");
  if (!resultado) return;

  if (resultado === "exitoso") {
    const caja = document.getElementById("pago-confirmado");
    // Si tenemos el pedido guardado, ofrecemos mandarlo por WhatsApp
    if (leerPedidoPendiente()) caja.hidden = false;
    vaciarCarrito();
    mostrarToast("¡Gracias por tu pago!");
  } else if (resultado === "fallido") {
    mostrarToast("El pago no se completó. Podés intentarlo de nuevo.");
  } else if (resultado === "pendiente") {
    mostrarToast("Tu pago quedó pendiente de confirmación.");
  }
}


/* ==========================================================
   9. MENÚ DE NAVEGACIÓN EN CELULAR
   ========================================================== */
function configurarMenuMovil() {
  const boton = document.getElementById("btn-menu");
  const nav = document.getElementById("nav");

  function cerrar() {
    nav.classList.remove("nav--abierta");
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-label", "Abrir menú de navegación");
  }

  boton.addEventListener("click", function () {
    const abierto = nav.classList.toggle("nav--abierta");
    boton.setAttribute("aria-expanded", String(abierto));
    boton.setAttribute("aria-label", abierto ? "Cerrar menú de navegación" : "Abrir menú de navegación");
  });

  // Al tocar un enlace, el menú se cierra
  nav.addEventListener("click", function (evento) {
    if (evento.target.closest("a")) cerrar();
  });

  // Con la tecla Escape también se cierra
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape") cerrar();
  });
}


/* ==========================================================
   10. FORMULARIO DE CONTACTO (demostración, no envía nada)
   ========================================================== */
function configurarFormulario() {
  const formulario = document.getElementById("formulario-contacto");
  const estado = document.getElementById("formulario-estado");

  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault(); // evita que la página se recargue

    const nombre = formulario.nombre.value.trim();
    const correo = formulario.correo.value.trim();
    const mensaje = formulario.mensaje.value.trim();

    estado.className = "formulario__estado";

    if (!nombre || !correo || !mensaje) {
      estado.textContent = "Completá todos los campos para enviar el mensaje.";
      estado.classList.add("formulario__estado--error");
      return;
    }
    if (correo.indexOf("@") === -1 || correo.indexOf(".") === -1) {
      estado.textContent = "Revisá el correo, parece incompleto.";
      estado.classList.add("formulario__estado--error");
      return;
    }

    estado.textContent = "¡Gracias, " + nombre + "! Esto es una demo, así que el mensaje no se envió.";
    estado.classList.add("formulario__estado--ok");
    formulario.reset();
  });
}


/* ==========================================================
   11. ARRANQUE
   ----------------------------------------------------------
   Los clics se manejan con "delegación de eventos": un solo oyente
   en el contenedor que detecta qué botón se tocó. Así funciona aunque
   los botones se vuelvan a dibujar.
   ========================================================== */
document.getElementById("menu-grilla").addEventListener("click", function (evento) {
  const boton = evento.target.closest("[data-agregar]");
  if (boton) agregarAlCarrito(boton.dataset.agregar);
});

document.getElementById("carrito-lista").addEventListener("click", function (evento) {
  const sumar = evento.target.closest("[data-sumar]");
  const restar = evento.target.closest("[data-restar]");
  const quitar = evento.target.closest("[data-quitar]");
  if (sumar) cambiarCantidad(sumar.dataset.sumar, 1);
  if (restar) cambiarCantidad(restar.dataset.restar, -1);
  if (quitar) quitarDelCarrito(quitar.dataset.quitar);
});

document.getElementById("form-mercadopago").addEventListener("submit", pagarMercadoPago);
document.getElementById("btn-whatsapp").addEventListener("click", pagarWhatsApp);
document.getElementById("btn-vaciar").addEventListener("click", vaciarCarrito);
document.getElementById("btn-whatsapp-confirmar").addEventListener("click", enviarPedidoConfirmadoPorWhatsApp);

dibujarMenu();
dibujarCarrito();
configurarMenuMovil();
configurarFormulario();
configurarTipoEntrega();
mostrarResultadoDePago();
