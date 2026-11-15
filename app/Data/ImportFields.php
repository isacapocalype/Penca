<?php

namespace App\Data;

final class ImportFields
{
    public const REQUIRED = [
        'marketplace_order_id',
        'ordered_at',
        'status',
        'sku',
        'product_name',
        'qty',
        'unit_price',
    ];

    public const LABELS = [
        'marketplace_order_id' => 'Order ID',
        'ordered_at' => 'Tanggal pesanan',
        'status' => 'Status',
        'sku' => 'SKU',
        'product_name' => 'Nama produk',
        'qty' => 'Jumlah',
        'unit_price' => 'Harga satuan',
        'seller_discount' => 'Diskon penjual',
        'marketplace_discount' => 'Diskon marketplace',
        'hpp_unit_snapshot' => 'HPP satuan',
        'fee_description' => 'Keterangan fee',
        'fee_amount' => 'Nominal fee',
        'fee_basis' => 'Dasar fee',
        'fee_rate_bp' => 'Tarif fee (bp)',
        'refund_amount' => 'Nominal refund',
        'refunded_at' => 'Tanggal refund',
        'completed_at' => 'Tanggal selesai',
        'notes' => 'Catatan',
    ];

    public const ALIASES = [
        'marketplace_order_id' => [
            'order id', 'orderid', 'marketplace order id', 'no pesanan', 'nomor pesanan',
            'id pesanan', 'order', 'invoice', 'no invoice',
        ],
        'ordered_at' => [
            'tanggal', 'tanggal pesanan', 'order date', 'ordered at', 'date', 'tgl',
        ],
        'status' => ['status', 'status pesanan', 'order status'],
        'sku' => ['sku', 'kode produk', 'seller sku', 'product sku', 'kode'],
        'product_name' => ['nama produk', 'produk', 'product name', 'nama barang', 'product'],
        'qty' => ['qty', 'quantity', 'jumlah', 'jumlah barang', 'kuantitas'],
        'unit_price' => ['harga satuan', 'harga', 'unit price', 'price', 'harga jual'],
        'seller_discount' => ['diskon penjual', 'diskon', 'seller discount', 'discount'],
        'marketplace_discount' => ['diskon marketplace', 'marketplace discount', 'diskon platform'],
        'hpp_unit_snapshot' => ['hpp satuan', 'hpp', 'hpp unit', 'modal', 'cost', 'unit cost'],
        'fee_description' => ['keterangan fee', 'fee description', 'biaya marketplace', 'jenis fee'],
        'fee_amount' => ['nominal fee', 'fee amount', 'biaya admin', 'admin fee', 'potongan', 'fee', 'biaya'],
        'fee_basis' => ['dasar fee', 'fee basis', 'basis'],
        'fee_rate_bp' => ['tarif fee', 'fee rate', 'persentase fee', 'rate bp', 'persen fee', 'fee persen'],
        'refund_amount' => ['nominal refund', 'refund', 'refund amount', 'nilai refund'],
        'refunded_at' => ['tanggal refund', 'refund date', 'refunded at'],
        'completed_at' => ['tanggal selesai', 'completion date', 'completed at', 'tanggal diterima'],
        'notes' => ['catatan', 'notes', 'note', 'keterangan'],
    ];

    /** @return array<string, int> */
    public static function autoMap(array $headers): array
    {
        $mapping = [];

        foreach ($headers as $index => $header) {
            $normalized = self::normalize((string) $header);

            foreach (self::ALIASES as $field => $aliases) {
                if (isset($mapping[$field])) {
                    continue;
                }

                foreach ($aliases as $alias) {
                    if ($normalized === self::normalize($alias)) {
                        $mapping[$field] = (int) $index;
                        break;
                    }
                }
            }
        }

        return $mapping;
    }

    /** @return array<int, string> */
    public static function mappingOptions(array $headers): array
    {
        $options = [];

        foreach ($headers as $index => $header) {
            $options[] = $index.': '.($header !== '' ? $header : '(tanpa judul)');
        }

        return $options;
    }

    public static function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = str_replace('%', ' persen ', $value);

        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $value));
    }
}
