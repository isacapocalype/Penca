<?php

namespace App\Support\Import;

use Carbon\CarbonImmutable;
use RuntimeException;
use SimpleXMLElement;
use Throwable;
use ZipArchive;

/**
 * Pembaca XLSX minimal. Memakai ZipArchive bila tersedia; bila tidak, file
 * XLSX ditolak dengan pesan yang jelas (bukan diam-diam gagal).
 */
final class XlsxReader
{
    /**
     * @return array{headers: array<int, string>, rows: array<int, array<int, string>>}
     */
    public function read(string $path): array
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException(
                'Pembaca XLSX membutuhkan ekstensi ZIP pada runtime. Gunakan CSV untuk import di perangkat ini.',
            );
        }

        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw new RuntimeException('File XLSX tidak dapat dibuka.');
        }

        try {
            $sharedStrings = $this->sharedStrings($zip);
            $sheetPath = $this->firstWorksheet($zip);
            $xml = $zip->getFromName($sheetPath);

            if ($xml === false) {
                throw new RuntimeException('Worksheet pertama tidak ditemukan di file XLSX.');
            }

            $sheet = $this->xml($xml);
            $namespace = $this->mainNamespace($sheet);

            $rows = [];

            foreach ($sheet->children($namespace)->sheetData->row as $row) {
                $index = (int) $row['r'] - 1;
                $cells = [];

                foreach ($row->children($namespace)->c as $cell) {
                    $reference = (string) $cell['r'];
                    $columnIndex = $this->columnIndex(preg_replace('/\d+/', '', $reference));
                    $type = (string) $cell['t'];
                    $value = '';

                    if ($type === 's') {
                        $sharedIndex = (int) $cell->children($namespace)->v;
                        $value = $sharedStrings[$sharedIndex] ?? '';
                    } elseif ($type === 'inlineStr') {
                        $value = $this->textFrom($cell->children($namespace)->is, $namespace);
                    } else {
                        $raw = (string) $cell->children($namespace)->v;
                        $value = $raw;
                    }

                    $cells[$columnIndex] = $value;
                }

                if ($cells === []) {
                    continue;
                }

                $max = max(array_keys($cells));
                $rows[$index] = array_map(
                    fn (int $column): string => trim((string) ($cells[$column] ?? '')),
                    range(0, $max),
                );
            }

            ksort($rows);
            $rows = array_values($rows);

            if ($rows === []) {
                return ['headers' => [], 'rows' => []];
            }

            $headers = array_map(fn (mixed $header): string => trim((string) $header), array_shift($rows));

            return ['headers' => $headers, 'rows' => $rows];
        } finally {
            $zip->close();
        }
    }

    /**
     * @return array<int, string>
     */
    private function sharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');

        if ($xml === false) {
            return [];
        }

        $document = $this->xml($xml);
        $namespace = $this->mainNamespace($document);
        $strings = [];

        foreach ($document->children($namespace)->si as $item) {
            $strings[] = $this->textFrom($item, $namespace);
        }

        return $strings;
    }

    private function firstWorksheet(ZipArchive $zip): string
    {
        $workbook = $zip->getFromName('xl/workbook.xml');
        $relations = $zip->getFromName('xl/_rels/workbook.xml.rels');

        if ($workbook !== false && $relations !== false) {
            $book = $this->xml($workbook);
            $bookNs = $this->mainNamespace($book);
            $relationNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
            $first = $book->children($bookNs)->sheets->sheet[0] ?? null;

            if ($first) {
                $relationId = (string) $first->attributes($relationNs)['id'];
                $rels = $this->xml($relations);

                foreach ($rels->Relationship as $relation) {
                    if ((string) $relation['Id'] === $relationId) {
                        $target = ltrim((string) $relation['Target'], '/');

                        return str_starts_with($target, 'xl/') ? $target : 'xl/'.$target;
                    }
                }
            }
        }

        for ($index = 1; $index <= 20; $index++) {
            $candidate = "xl/worksheets/sheet{$index}.xml";
            if ($zip->locateName($candidate) !== false) {
                return $candidate;
            }
        }

        throw new RuntimeException('Worksheet pertama tidak ditemukan di file XLSX.');
    }

    private function textFrom(?SimpleXMLElement $node, string $namespace): string
    {
        if (! $node) {
            return '';
        }

        $text = '';

        foreach ($node->xpath('.//*[local-name()="t"]') as $part) {
            $text .= (string) $part;
        }

        return $text;
    }

    private function xml(string $xml): SimpleXMLElement
    {
        $document = simplexml_load_string($xml);

        if ($document === false) {
            throw new RuntimeException('Struktur XML di dalam file XLSX tidak valid.');
        }

        return $document;
    }

    private function mainNamespace(SimpleXMLElement $document): string
    {
        $namespaces = $document->getDocNamespaces();

        return $namespaces[''] ?? 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    }

    private function columnIndex(string $letters): int
    {
        $index = 0;

        foreach (str_split($letters) as $letter) {
            $index = ($index * 26) + (ord(strtoupper($letter)) - 64);
        }

        return max(0, $index - 1);
    }

    /**
     * Excel menyimpan tanggal sebagai serial hari. Dipakai hanya jika nilai
     * tanggal dari file berupa angka.
     */
    public static function excelDate(int $serial): ?string
    {
        try {
            if ($serial < 1 || $serial > 100000) {
                return null;
            }

            return CarbonImmutable::create(1899, 12, 30, 0, 0, 0, 'Asia/Jakarta')
                ->addDays($serial)
                ->toDateString();
        } catch (Throwable) {
            return null;
        }
    }
}
