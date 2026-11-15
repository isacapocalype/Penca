<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    public static function value(string $key, ?string $default = null): ?string
    {
        $setting = static::query()->find($key);

        return $setting?->value ?? $default;
    }

    public static function integer(string $key, int $default = 0): int
    {
        $value = static::value($key);

        return $value === null || $value === '' ? $default : (int) $value;
    }

    public static function boolean(string $key, bool $default = false): bool
    {
        $value = static::value($key);

        return $value === null ? $default : in_array($value, ['1', 'true', 'yes'], true);
    }

    public static function put(string $key, string|int|bool|null $value): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value],
        );
    }
}
