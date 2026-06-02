#!/bin/bash

# Konfigurasi Variabel Lingkungan
BACKUP_DIR="/var/backups/rayanxweb"
MONGO_URI="mongodb+srv://admin:securepassword@cluster0.mongodb.net/rayanxweb_prod"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

# Membuat direktori backup jika belum ada
mkdir -p "$BACKUP_DIR"

echo "==== Starting MongoDB Atlas Backup Process [$(date)] ===="

# Melakukan mongodump langsung ke file arsip terkompresi
mongodump --uri="$MONGO_URI" --archive="$OUTPUT_FILE" --gzip

if [ $? -eq 0 ]; then
    echo "✔ Backup completed successfully: $OUTPUT_FILE"
    
    # Hapus backup lama yang berumur lebih dari 7 hari untuk menghemat storage
    find "$BACKUP_DIR" -type f -name "backup_*.tar.gz" -mtime +7 -delete
    echo "✔ Maintenance completed: Purged backup files older than 7 days."
else
    echo "❌ Backup process failed!" >&2
    exit 1
fi
