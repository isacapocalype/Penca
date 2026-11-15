<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Backup extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'file_name', 'json_path', 'db_path', 'size', 'schema_version',
        'checksum', 'reason', 'created_at', 'restored_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'restored_at' => 'datetime',
            'size' => 'integer',
            'schema_version' => 'integer',
        ];
    }
}
