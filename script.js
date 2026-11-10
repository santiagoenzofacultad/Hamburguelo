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
   CÓMO CAMBIAR LOS LINKS:
   - Creá una cuenta en el servicio que quieras (Mercado Pago, Stripe, PayPal...)
     y usá su MODO DE PRUEBAS (sandbox / test), así no se mueve plata real.
   - Generá un "link de pago" desde el panel de ese servicio.
   - Pegalo donde dice "REEMPLAZAR POR TU LINK".

   MODOS DISPONIBLES:
   - "link":     el botón Pagar lleva al link de pago.
   - "whatsapp": el botón Pagar arma el pedido y abre WhatsApp.

   IMPORTANTE: un link de pago fijo tiene un monto fijo. Para que el monto
   coincida con el total del carrito hace falta un pequeño servidor que cree
   el cobro con el total (por ejemplo, con funciones de Netlify).
   Para una demo, un link de prueba alcanza.
   ========================================================== */
const CONFIG_PAGO = {
  modo: "link", // "link" o "whatsapp"

  // REEMPLAZAR POR TU LINK (de un servicio de pagos en modo de pruebas)
  linkDePago: "https://REEMPLAZAR-POR-TU-LINK-DE-PAGO",

  // REEMPLAZAR POR TU NÚMERO (formato internacional, sin + ni espacios). Solo para el modo "whatsapp".
  whatsappNumero: "59800000000"
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
function pagar() {
  const aviso = document.getElementById("aviso-pago");
  aviso.textContent = "";

  if (carrito.length === 0) return;

  if (CONFIG_PAGO.modo === "whatsapp") {
    // Armamos un texto con el pedido y lo mandamos por WhatsApp
    const lineas = carrito.map(function (item) {
      const p = buscarProducto(item.id);
      return "• " + item.cantidad + " x " + p.nombre + " (" + formatoDinero.format(p.precio * item.cantidad) + ")";
    });
    const mensaje = "Hola Hamburguelo! Quiero hacer este pedido:\n" + lineas.join("\n") +
                    "\nTotal: " + formatoDinero.format(calcularTotal());
    const url = "https://wa.me/" + CONFIG_PAGO.whatsappNumero + "?text=" + encodeURIComponent(mensaje);
    window.open(url, "_blank", "noopener");
    return;
  }

  // Modo "link": si todavía está el texto de ejemplo, avisamos en vez de ir a una dirección falsa
  if (CONFIG_PAGO.linkDePago.indexOf("REEMPLAZAR") !== -1) {
    aviso.textContent = "Demo: falta cargar el link de pago en CONFIG_PAGO (script.js).";
    return;
  }

  window.location.href = CONFIG_PAGO.linkDePago;
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

document.getElementById("btn-pagar").addEventListener("click", pagar);
document.getElementById("btn-vaciar").addEventListener("click", vaciarCarrito);

dibujarMenu();
dibujarCarrito();
configurarMenuMovil();
configurarFormulario();
