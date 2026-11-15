<?php

namespace App\Services;

use App\Data\FinancialSummary;
use App\Support\Export\SimplePdf;
use App\Support\Export\XlsxWriter;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\File;
use RuntimeException;

class ReportExporter
{
    /**
     * @return array{path: string, name: string, mime: string}
     */
    public function export(FinancialSummary $summary, string $format): array
    {
        $format = strtolower($format);
        $baseName = 'penca-laporan-'.now()->format('Ymd-His');
        $directory = storage_path('app/exports');

        File::ensureDirectoryExists($directory);

        $path = match ($format) {
            'csv' => $directory.'/'.$baseName.'.csv',
            'xlsx' => $directory.'/'.$baseName.'.xlsx',
            'pdf' => $directory.'/'.$baseName.'.pdf',
            default => throw new RuntimeException('Format laporan harus CSV, XLSX, atau PDF.'),
        };

        match ($format) {
            'csv' => $this->writeCsv($summary, $path),
            'xlsx' => $this->writeXlsx($summary, $path),
            'pdf' => $this->writePdf($summary, $path),
        };

        if (! is_file($path) || filesize($path) === 0) {
            throw new RuntimeException('File laporan gagal dibuat.');
        }

        return [
            'path' => $path,
            'name' => basename($path),
            'mime' => match ($format) {
                'csv' => 'text/csv',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'pdf' => 'application/pdf',
            },
        ];
    }

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    public function summaryRows(FinancialSummary $summary): array
    {
        return [
            ['Omzet bruto', Money::rupiah($summary->grossRevenue)],
            ['Diskon penjual', Money::rupiah($summary->sellerDiscount)],
            ['Refund', Money::rupiah($summary->refunds)],
            ['Pendapatan neto', Money::rupiah($summary->netRevenue)],
            ['HPP', Money::rupiah($summary->hpp)],
            ['Laba kotor', Money::rupiah($summary->grossProfit)],
            ['Fee marketplace', Money::rupiah($summary->marketplaceFees)],
            ['Biaya iklan', Money::rupiah($summary->advertising)],
            ['Biaya operasional', Money::rupiah($summary->operational)],
            ['Laba operasional', Money::rupiah($summary->operatingProfit)],
            ['PPh Final', Money::rupiah($summary->pphFinal)],
            ['Laba bersih', Money::rupiah($summary->netProfit)],
            ['Margin', number_format($summary->marginBp / 100, 2, ',', '.').'%'],
            ['PPN keluaran', Money::rupiah($summary->ppnOutput)],
            ['PPN masukan', Money::rupiah($summary->ppnInput)],
            ['PPN kurang bayar', Money::rupiah($summary->ppnPayable)],
            ['Jumlah pesanan', (string) $summary->orderCount],
            ['Produk terjual', (string) $summary->itemsSold],
            ['Dana dicairkan', Money::rupiah($summary->settlementTotal)],
        ];
    }

    /**
     * @return array<int, array<int, string>>
     */
    public function dailyRows(FinancialSummary $summary): array
    {
        return array_map(fn (array $day): array => [
            CarbonImmutable::parse($day['date'])->translatedFormat('d M Y'),
            (string) $day['orders'],
            Money::rupiah($day['gross']),
            Money::rupiah($day['operating_profit']),
            Money::rupiah($day['net_profit']),
        ], $summary->daily);
    }

    /**
     * @return array<int, array<int, string>>
     */
    public function storeRows(FinancialSummary $summary): array
    {
        return array_map(fn (array $store): array => [
            (string) $store['name'],
            (string) $store['marketplace'],
            (string) $store['orders'],
            Money::rupiah($store['gross']),
            Money::rupiah($store['fees']),
            Money::rupiah($store['ads'] ?? 0),
            Money::rupiah($store['hpp']),
            Money::rupiah($store['refunds']),
            Money::rupiah($store['net_profit']),
        ], $summary->stores);
    }

    private function writeCsv(FinancialSummary $summary, string $path): void
    {
        $handle = fopen($path, 'wb');

        if ($handle === false) {
            throw new RuntimeException('File CSV tidak dapat dibuat.');
        }

        fwrite($handle, "\xEF\xBB\xBF");

        $this->csvRow($handle, ['Laporan Penca']);
        $this->csvRow($handle, ['Periode', $summary->periodLabel()]);
        $this->csvRow($handle, ['Toko', $summary->storeName]);
        $this->csvRow($handle, ['Dibuat', now()->translatedFormat('d F Y H:i').' WIB']);
        $this->csvRow($handle, []);

        $this->csvRow($handle, ['Ringkasan', 'Nilai']);
        foreach ($this->summaryRows($summary) as $row) {
            $this->csvRow($handle, $row);
        }

        $this->csvRow($handle, []);
        $this->csvRow($handle, ['Harian', 'Pesanan', 'Omzet', 'Laba operasional', 'Laba bersih']);
        foreach ($this->dailyRows($summary) as $row) {
            $this->csvRow($handle, $row);
        }

        $this->csvRow($handle, []);
        $this->csvRow($handle, [
            'Toko', 'Marketplace', 'Pesanan', 'Omzet', 'Fee', 'Iklan', 'HPP', 'Refund', 'Laba bersih',
        ]);
        foreach ($this->storeRows($summary) as $row) {
            $this->csvRow($handle, $row);
        }

        fclose($handle);
    }

    /**
     * @param  resource  $handle
     * @param  array<int, string>  $row
     */
    private function csvRow($handle, array $row): void
    {
        fputcsv($handle, $row, ',', '"', '\\');
    }

    private function writeXlsx(FinancialSummary $summary, string $path): void
    {
        $writer = new XlsxWriter('Laporan');

        $writer->addRow(['Laporan Penca'], true);
        $writer->addRow(['Periode', $summary->periodLabel()]);
        $writer->addRow(['Toko', $summary->storeName]);
        $writer->addRow(['Dibuat', now()->translatedFormat('d F Y H:i').' WIB']);
        $writer->addBlankRow();

        $writer->addRow(['Ringkasan', 'Nilai'], true);
        foreach ($this->summaryRows($summary) as $row) {
            $writer->addRow($row);
        }

        $writer->addBlankRow();
        $writer->addRow(['Harian', 'Pesanan', 'Omzet', 'Laba operasional', 'Laba bersih'], true);
        foreach ($this->dailyRows($summary) as $row) {
            $writer->addRow($row);
        }

        $writer->addBlankRow();
        $writer->addRow([
            'Toko', 'Marketplace', 'Pesanan', 'Omzet', 'Fee', 'Iklan', 'HPP', 'Refund', 'Laba bersih',
        ], true);
        foreach ($this->storeRows($summary) as $row) {
            $writer->addRow($row);
        }

        $writer->save($path);
    }

    private function writePdf(FinancialSummary $summary, string $path): void
    {
        $pdf = new SimplePdf('Laporan Penca');
        $pdf->title('Laporan Keuangan Penca');
        $pdf->subtitle('Periode: '.$summary->periodLabel());
        $pdf->subtitle('Toko: '.$summary->storeName);
        $pdf->subtitle('Dibuat: '.now()->translatedFormat('d F Y H:i').' WIB');
        $pdf->section('Ringkasan');
        foreach ($this->summaryRows($summary) as $row) {
            $pdf->field($row[0], $row[1]);
        }

        $pdf->section('Rincian harian');
        $pdf->table(
            ['Tanggal', 'Pesanan', 'Omzet', 'Laba operasional', 'Laba bersih'],
            $this->dailyRows($summary),
            [100, 70, 120, 120, 120],
        );

        $pdf->section('Performa toko');
        $pdf->table(
            ['Toko', 'Marketplace', 'Pesanan', 'Omzet', 'Laba bersih'],
            array_map(
                fn (array $row): array => [$row[0], $row[1], $row[2], $row[3], $row[8]],
                $this->storeRows($summary),
            ),
            [120, 80, 60, 110, 120],
        );

        $pdf->save($path);
    }
}
