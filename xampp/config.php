<?php
// Configuración sin secretos. Las cuentas se crean desde configurar.php en localhost.
return [
    'default_mode' => 'demo',
    // null: guarda datos fuera de htdocs, en <carpeta de XAMPP>/sigeia-data/<instalación>.
    // Si lo cambias, usa una ruta absoluta FUERA de cualquier carpeta publicada por Apache.
    'storage_dir' => null,
];
