const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'dev_secret_key_only_for_local';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./huellavital.db', (err) => {
    if (err) {
        console.error('Error db connection:', err.message);
    } else {
        console.log('System info: Database connected successfully.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        propietario TEXT,
        mascota TEXT,
        servicios TEXT,
        fecha TEXT,
        hora TEXT,
        estado TEXT, 
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT UNIQUE, 
        password TEXT
    )`);

    const insertAdmin = db.prepare(`INSERT OR IGNORE INTO usuarios (username, password) VALUES (?, ?)`);
    insertAdmin.run('admin', 'admin123');
    insertAdmin.finalize();
});

const servicios = [
    { id: 1, categoria: 'Salud', nombre: 'Esterilización y vacunación', icono: '🩺', precio: 85000 },
    { id: 2, categoria: 'Salud', nombre: 'Radiologías y ecografías', icono: '🩻', precio: 120000 },
    { id: 3, categoria: 'Salud', nombre: 'Laboratorios Clínicos', icono: '🔬', precio: 50000 },
    { id: 4, categoria: 'Estética', nombre: 'Peluquería y corte de uñas', icono: '✂️', precio: 45000 },
    { id: 5, categoria: 'Estética', nombre: 'Limpieza bucal y masajes', icono: '🦷', precio: 60000 },
    { id: 6, categoria: 'Nutrición', nombre: 'Asesorías de alimentación', icono: '🥩', precio: 30000 },
    { id: 7, categoria: 'Guardería', nombre: 'Pasa día en Hotel', icono: '🏡', precio: 35000 },
    { id: 8, categoria: 'Funeraria', nombre: 'Servicios Funerarios', icono: '🕊️', precio: 250000 }
];

app.get('/api/servicios', (req, res) => res.json(servicios));

app.post('/api/citas', (req, res) => {
    const { propietario, mascota, carritoIds, fecha, hora } = req.body;
    
    if (!propietario || !mascota || !fecha || !hora) {
        return res.status(400).json({ error: 'Data validation failed: Missing fields.' });
    }
    if (!carritoIds || carritoIds.length === 0) {
        return res.status(400).json({ error: 'Data validation failed: Empty cart.' });
    }

    try {
        const horaNum = parseInt(hora.split(':')[0]);
        if (horaNum < 8 || horaNum >= 18) {
            return res.status(400).json({ error: 'El horario de atención es de 08:00 a 18:00 hrs.' });
        }

        const queryMascota = `SELECT id FROM citas WHERE LOWER(TRIM(propietario)) = LOWER(TRIM(?)) AND LOWER(TRIM(mascota)) = LOWER(TRIM(?)) AND fecha = ? AND estado = 'Pendiente'`;
        
        db.get(queryMascota, [propietario, mascota, fecha], (err, rowMascota) => {
            if (err) return res.status(500).json({ error: 'Database error fetching records.' });
            
            if (rowMascota) {
                return res.status(400).json({ error: `La mascota ${mascota} ya cuenta con una reserva activa para hoy. Le sugerimos agrupar los servicios.` });
            }

            db.get(`SELECT id FROM citas WHERE fecha = ? AND hora = ? AND estado = 'Pendiente'`, [fecha, hora], (err, rowHora) => {
                if (err) return res.status(500).json({ error: 'Database error checking availability.' });
                if (rowHora) return res.status(400).json({ error: 'El horario seleccionado ya no se encuentra disponible.' });

                const serviciosSeleccionados = servicios.filter(s => carritoIds.includes(s.id.toString()) || carritoIds.includes(s.id));
                const resumenServicios = serviciosSeleccionados.map(s => s.nombre).join(' + ');

                const sql = `INSERT INTO citas (propietario, mascota, servicios, fecha, hora, estado) VALUES (?, ?, ?, ?, ?, 'Pendiente')`;
                db.run(sql, [propietario, mascota, resumenServicios, fecha, hora], function(err) {
                    if (err) return res.status(500).json({ error: 'Database error saving record.' });
                    res.status(201).json({ mensaje: 'Reserva procesada exitosamente.', id: this.lastID });
                });
            });
        });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error processing request.' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM usuarios WHERE username = ? AND password = ?`, [username, password], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'Unauthorized.' });
        res.json({ token: jwt.sign({ id: row.id, username: row.username }, SECRET_KEY, { expiresIn: '2h' }) });
    });
});

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'Forbidden: No token provided.' });
    
    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
        req.user = decoded;
        next();
    });
};

app.get('/api/admin/citas', verificarToken, (req, res) => {
    db.all(`SELECT * FROM citas ORDER BY fecha DESC, hora DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching records.' });
        res.json(rows);
    });
});

app.put('/api/admin/citas/:id/estado', verificarToken, (req, res) => {
    const { estado } = req.body;
    db.run(`UPDATE citas SET estado = ? WHERE id = ?`, [estado, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error updating state.' });
        res.json({ mensaje: 'State updated successfully.' });
    });
});

app.listen(PORT, () => {
    console.log(`System info: Service running on port ${PORT}`);
});