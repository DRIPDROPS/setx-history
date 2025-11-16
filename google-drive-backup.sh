#!/bin/bash

# Google Drive Backup Script
# Backs up the history database to Google Drive nightly

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="$SCRIPT_DIR/database.sqlite"
BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/history-backup-$TIMESTAMP.sqlite"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting Google Drive backup..."
echo "   Database: $DB_FILE"
echo "   Backup: $BACKUP_FILE"

# Create local backup
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Local backup created: $BACKUP_FILE"
else
    echo "❌ Failed to create local backup"
    exit 1
fi

# Upload to Google Drive using rclone (if configured)
if command -v rclone &> /dev/null; then
    echo "📤 Uploading to Google Drive..."
    rclone copy "$BACKUP_FILE" gdrive:setx-history-backups/

    if [ $? -eq 0 ]; then
        echo "✅ Uploaded to Google Drive successfully"
    else
        echo "⚠️  Failed to upload to Google Drive (check rclone config)"
    fi
else
    echo "⚠️  rclone not found. Install with: curl https://rclone.org/install.sh | sudo bash"
    echo "   Then configure: rclone config"
fi

# Keep only last 7 days of local backups
find "$BACKUP_DIR" -name "history-backup-*.sqlite" -type f -mtime +7 -delete
echo "🧹 Cleaned up old local backups (kept last 7 days)"

echo "✅ Backup complete!"
