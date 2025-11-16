#!/bin/bash

# Setup nightly backup cron job

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/google-drive-backup.sh"

echo "Setting up nightly backup cron job..."

# Add cron job (runs at 2 AM daily)
CRON_JOB="0 2 * * * $BACKUP_SCRIPT >> $SCRIPT_DIR/backups/backup.log 2>&1"

# Check if cron job already exists
(crontab -l 2>/dev/null | grep -F "$BACKUP_SCRIPT") && {
    echo "⚠️  Backup cron job already exists"
    exit 0
}

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Backup cron job added successfully"
    echo "   Schedule: Daily at 2:00 AM"
    echo "   Script: $BACKUP_SCRIPT"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep -F "$BACKUP_SCRIPT"
else
    echo "❌ Failed to add cron job"
    exit 1
fi
