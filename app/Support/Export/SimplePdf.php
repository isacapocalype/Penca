<?php

namespace App\Support\Export;

use RuntimeException;

/**
 * Penulis PDF minimal tanpa dependency eksternal. Cukup untuk laporan teks
 * dan tabel sederhana yang dapat dibuka di aplikasi PDF mana pun.
 */
final class SimplePdf
{
    private const PAGE_WIDTH = 595.28;

    private const PAGE_HEIGHT = 841.89;

    private const MARGIN = 40.0;

    /** @var array<int, string> */
    private array $pages = [];

    private string $current = '';

    private float $y;

    public function __construct(private readonly string $title)
    {
        $this->y = self::PAGE_HEIGHT - self::MARGIN;
    }

    public function title(string $text): void
    {
        $this->ensureSpace(30);
        $this->textAt(self::MARGIN, $this->y, $text, 'F2', 17);
        $this->y -= 24;
    }

    public function subtitle(string $text): void
    {
        $this->ensureSpace(18);
        $this->textAt(self::MARGIN, $this->y, $text, 'F1', 10);
        $this->y -= 15;
    }

    public function blank(float $space = 10): void
    {
        $this->y -= $space;
    }

    public function section(string $text): void
    {
        $this->ensureSpace(30);
        $this->y -= 6;
        $this->textAt(self::MARGIN, $this->y, $text, 'F2', 12);
        $this->y -= 18;
    }

    public function field(string $label, string $value): void
    {
        $this->ensureSpace(16);
        $this->textAt(self::MARGIN, $this->y, $label, 'F1', 10);
        $this->textAt(210, $this->y, ': '.$value, 'F1', 10);
        $this->y -= 14;
    }

    /**
     * @param  array<int, string>  $headers
     * @param  array<int, array<int, string>>  $rows
     * @param  array<int, float>  $widths
     */
    public function table(array $headers, array $rows, array $widths): void
    {
        $this->ensureSpace(20);
        $x = self::MARGIN;
        foreach ($headers as $index => $header) {
            $this->textAt($x, $this->y, $header, 'F2', 9);
            $x += $widths[$index] ?? 80;
        }
        $this->y -= 5;
        $this->line(self::MARGIN, $this->y, self::PAGE_WIDTH - self::MARGIN);
        $this->y -= 12;

        foreach ($rows as $row) {
            $this->ensureSpace(16);
            $x = self::MARGIN;
            foreach ($row as $index => $cell) {
                $this->textAt($x, $this->y, $this->truncate((string) $cell, $widths[$index] ?? 80), 'F1', 9);
                $x += $widths[$index] ?? 80;
            }
            $this->y -= 13;
        }
    }

    public function save(string $path): void
    {
        $this->pages[] = $this->current;

        $objects = [];
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

        $pageObjectNumbers = [];
        $next = 5;

        foreach ($this->pages as $content) {
            $contentNumber = $next++;
            $pageNumber = $next++;
            $objects[$contentNumber] = '<< /Length '.strlen($content)." >>\nstream\n".$content."\nendstream";
            $objects[$pageNumber] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '
                .self::PAGE_WIDTH.' '.self::PAGE_HEIGHT.'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '
                .$contentNumber.' 0 R >>';
            $pageObjectNumbers[] = $pageNumber;
        }

        $objects[2] = '<< /Type /Pages /Kids ['.implode(' ', array_map(
            fn (int $number): string => $number.' 0 R',
            $pageObjectNumbers,
        )).'] /Count '.count($pageObjectNumbers).' >>';

        ksort($objects);

        $pdf = '%PDF-1.4'."\n";
        $offsets = [];

        foreach ($objects as $number => $body) {
            $offsets[$number] = strlen($pdf);
            $pdf .= $number." 0 obj\n".$body."\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= 'xref'."\n".'0 '.(count($objects) + 1)."\n";
        $pdf .= "0000000000 65535 f \n";

        for ($object = 1; $object <= count($objects); $object++) {
            $pdf .= sprintf('%010d 00000 n ', $offsets[$object])."\n";
        }

        $pdf .= 'trailer << /Size '.(count($objects) + 1).' /Root 1 0 R >>'."\n";
        $pdf .= 'startxref'."\n".$xrefOffset."\n".'%%EOF';

        if (file_put_contents($path, $pdf) === false) {
            throw new RuntimeException('File PDF tidak dapat ditulis ke penyimpanan.');
        }
    }

    private function ensureSpace(float $needed): void
    {
        if ($this->y - $needed < self::MARGIN) {
            $this->pages[] = $this->current;
            $this->current = '';
            $this->y = self::PAGE_HEIGHT - self::MARGIN;
            $this->textAt(self::MARGIN, $this->y, $this->title.' - lanjutan', 'F2', 12);
            $this->y -= 22;
        }
    }

    private function textAt(float $x, float $y, string $text, string $font, float $size): void
    {
        $encoded = $this->encode($text);
        $this->current .= 'BT /'.$font.' '.$size.' Tf '.sprintf('%.2F %.2F', $x, $y).' Td ('
            .$encoded.") Tj ET\n";
    }

    private function line(float $x, float $y, float $to): void
    {
        $this->current .= sprintf('%.2F %.2F m %.2F %.2F l S', $x, $y, $to, $y)."\n";
    }

    private function encode(string $text): string
    {
        $converted = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
        $text = $converted === false ? preg_replace('/[^\x20-\x7E]/', '', $text) : $converted;

        return str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', ' ', ' '], $text);
    }

    private function truncate(string $text, float $width): string
    {
        $limit = max(4, (int) floor($width / 4.6));

        return mb_strlen($text) > $limit ? mb_substr($text, 0, $limit - 1).'…' : $text;
    }
}
