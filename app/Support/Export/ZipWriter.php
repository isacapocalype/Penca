<?php

namespace App\Support\Export;

use RuntimeException;

/**
 * Penulis ZIP sederhana tanpa ekstensi zip. XLSX hanyalah arsip ZIP berisi
 * XML, jadi metode "store" sudah cukup dan lebih portabel di runtime PHP
 * perangkat.
 */
final class ZipWriter
{
    /** @var array<int, array{name: string, data: string, crc: int, offset: int}> */
    private array $entries = [];

    private string $contents = '';

    public function add(string $name, string $data): void
    {
        $offset = strlen($this->contents);
        $crc = crc32($data) & 0xFFFFFFFF;
        $size = strlen($data);
        $time = $this->dosTime();
        $date = $this->dosDate();

        $header = pack(
            'VvvvvvVVVvv',
            0x04034B50,
            20,
            0,
            0,
            $time,
            $date,
            $crc,
            $size,
            $size,
            strlen($name),
            0,
        );

        $this->contents .= $header.$name.$data;
        $this->entries[] = compact('name', 'data', 'crc', 'offset');
    }

    public function save(string $path): void
    {
        $central = '';
        $offset = strlen($this->contents);
        $time = $this->dosTime();
        $date = $this->dosDate();

        foreach ($this->entries as $entry) {
            $size = strlen($entry['data']);
            $central .= pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014B50,
                20,
                20,
                0,
                0,
                $time,
                $date,
                $entry['crc'],
                $size,
                $size,
                strlen($entry['name']),
                0,
                0,
                0,
                0,
                0,
                $entry['offset'],
            ).$entry['name'];
        }

        $end = pack(
            'VvvvvVVv',
            0x06054B50,
            0,
            0,
            count($this->entries),
            count($this->entries),
            strlen($central),
            $offset,
            0,
        );

        $archive = $this->contents.$central.$end;

        if (file_put_contents($path, $archive) === false) {
            throw new RuntimeException('File XLSX tidak dapat ditulis ke penyimpanan.');
        }
    }

    private function dosTime(): int
    {
        $now = getdate();

        return ($now['hours'] << 11) | ($now['minutes'] << 5) | intdiv($now['seconds'], 2);
    }

    private function dosDate(): int
    {
        $now = getdate();

        return (($now['year'] - 1980) << 9) | ($now['mon'] << 5) | $now['mday'];
    }
}
