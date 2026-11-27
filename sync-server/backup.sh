#!/bin/bash
set -euo pipefail
umask 077
while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  tmp="/backups/.hot100-${stamp}.sql.gz.tmp"
  if mysqldump -h mysql -u hot100 --single-transaction --no-tablespaces hot100 | gzip > "$tmp"; then
    mv "$tmp" "/backups/hot100-${stamp}.sql.gz"
    find /backups -name 'hot100-*.sql.gz' -mtime +30 -delete
  else
    rm -f "$tmp"
    echo 'Hot100 backup failed' >&2
  fi
  sleep 86400
done
