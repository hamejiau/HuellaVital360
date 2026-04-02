let carrito = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/servicios');
        const servicios = await res.json();
        const contenedor = document.getElementById('contenedor-servicios');

        servicios.forEach(srv => {
            contenedor.innerHTML += `
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between">
                    <div>
                        <div class="text-4xl mb-4">${srv.icono}</div>
                        <span class="text-xs font-bold text-indigo-500 uppercase tracking-wider">${srv.categoria}</span>
                        <h4 class="font-bold text-lg text-slate-900 mt-1 leading-tight">${srv.nombre}</h4>
                    </div>
                    <div>
                        <p class="text-slate-900 font-black mt-4">$${srv.precio.toLocaleString()}</p>
                        <button onclick="agregarAlCarrito('${srv.id}', '${srv.nombre}', ${srv.precio})" class="mt-4 w-full bg-slate-50 hover:bg-indigo-600 hover:text-white text-indigo-600 font-bold py-2 rounded-lg transition border border-indigo-100">
                            + Añadir
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Init Error:", error);
    }

    document.getElementById('form-cita').addEventListener('submit', agendarCita);
});

function agregarAlCarrito(id, nombre, precio) {
    if (!carrito.some(item => item.id === id)) {
        carrito.push({ id, nombre, precio });
        actualizarUI();
        const badge = document.getElementById('badge-carrito');
        badge.classList.add('animate-ping');
        setTimeout(() => badge.classList.remove('animate-ping'), 300);
    }
}

function removerDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('badge-carrito').textContent = carrito.length;
    const lista = document.getElementById('lista-carrito');
    
    if(carrito.length === 0) {
        lista.innerHTML = '<p class="text-slate-400 text-center mt-10">Sin servicios agregados.</p>';
        return;
    }

    let total = 0;
    lista.innerHTML = carrito.map(item => {
        total += item.precio;
        return `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div class="flex-grow pr-2">
                    <span class="font-semibold text-sm text-slate-800 block">${item.nombre}</span>
                    <span class="text-xs text-indigo-600 font-bold">$${item.precio.toLocaleString()}</span>
                </div>
                <button onclick="removerDelCarrito('${item.id}')" class="text-slate-400 hover:text-red-500 font-bold text-lg w-8 h-8 flex items-center justify-center transition">&times;</button>
            </div>
        `;
    }).join('');

    lista.innerHTML += `
        <div class="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
            <span class="font-bold text-slate-600">Total Estimado:</span>
            <span class="font-black text-lg text-slate-900">$${total.toLocaleString()}</span>
        </div>
    `;
}

function mostrarNotificacion(titulo, mensaje, esError = false) {
    const toast = document.getElementById('toast-notificacion');
    
    document.getElementById('toast-titulo').textContent = titulo;
    document.getElementById('toast-mensaje').textContent = mensaje;
    
    if (esError) {
        toast.classList.replace('bg-green-500', 'bg-red-500');
        document.getElementById('toast-icono').textContent = '⚠️';
    } else {
        toast.classList.replace('bg-red-500', 'bg-green-500');
        document.getElementById('toast-icono').textContent = '✅';
    }

    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-24', 'opacity-0'), 4000);
}

async function agendarCita(e) {
    e.preventDefault();
    if(carrito.length === 0) {
        mostrarNotificacion('Operación denegada', 'Seleccione al menos un servicio.', true);
        return;
    }

    const data = {
        propietario: document.getElementById('propietario').value,
        mascota: document.getElementById('mascota').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        carritoIds: carrito.map(item => item.id)
    };

    try {
        const res = await fetch('/api/citas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const resData = await res.json();

        if (res.ok) {
            mostrarNotificacion('Confirmación', 'Reserva registrada exitosamente.');
            carrito = [];
            actualizarUI();
            document.getElementById('form-cita').reset();
            document.getElementById('modal-carrito').classList.add('hidden');
        } else {
            mostrarNotificacion('Notificación del Sistema', resData.error, true);
        }
    } catch (error) {
        console.error("Tx Error:", error);
        mostrarNotificacion('Error', 'Fallo de conexión.', true);
    }
}