<?php

namespace App\NativeComponents;

use App\Models\Marketplace;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Options;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class StoreForm extends NativeComponent
{
    use HandlesFeedback;

    public ?string $storeId = null;

    public string $marketplaceLabel = '';

    public string $name = '';

    public string $code = '';

    public string $username = '';

    public string $url = '';

    public string $statusLabel = 'Aktif';

    public string $notes = '';

    public function mount(): void
    {
        $this->storeId = $this->param('id');

        if ($this->storeId === null) {
            $first = Marketplace::query()->where('active', true)->orderBy('name')->first();
            $this->marketplaceLabel = $first?->name ?? '';

            return;
        }

        $store = Store::query()->with('marketplace:id,name')->find($this->storeId);

        if (! $store) {
            return;
        }

        $this->marketplaceLabel = $store->marketplace?->name ?? '';
        $this->name = $store->name;
        $this->code = $store->code;
        $this->username = (string) ($store->username ?? '');
        $this->url = (string) ($store->url ?? '');
        $this->statusLabel = Options::storeStatusLabel($store->status);
        $this->notes = (string) ($store->notes ?? '');
    }

    public function render(): Element|View
    {
        return view('native.store-form', [
            'editing' => $this->storeId !== null,
            'marketplaceOptions' => Options::marketplaces(),
            'statusOptions' => Options::storeStatuses(),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function save(): void
    {
        $this->clearFeedback();

        $marketplaceId = Options::marketplaceIdFromLabel($this->marketplaceLabel);
        $store = $this->storeId !== null ? Store::query()->find($this->storeId) : null;

        $data = [
            'marketplace_id' => $marketplaceId,
            'name' => trim($this->name),
            'code' => strtoupper(trim($this->code)),
            'username' => trim($this->username) !== '' ? trim($this->username) : null,
            'url' => trim($this->url) !== '' ? trim($this->url) : null,
            'status' => Options::storeStatusFromLabel($this->statusLabel),
            'notes' => trim($this->notes) !== '' ? trim($this->notes) : null,
        ];

        $validator = Validator::make($data, [
            'marketplace_id' => ['required', 'uuid', 'exists:marketplaces,id'],
            'name' => ['required', 'string', 'max:120'],
            'code' => ['required', 'string', 'max:60'],
            'username' => ['nullable', 'string', 'max:120'],
            'url' => ['nullable', 'url', 'max:255'],
            'status' => ['required', 'in:active,inactive,archived'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'marketplace_id.required' => 'Pilih marketplace terlebih dahulu.',
            'name.required' => 'Nama toko wajib diisi.',
            'code.required' => 'Kode toko wajib diisi.',
            'url.url' => 'URL toko harus berupa alamat lengkap, misalnya https://shopee.co.id/toko.',
        ]);

        if ($validator->fails()) {
            $this->captureFailure(new ValidationException($validator));

            return;
        }

        $duplicate = Store::query()
            ->withTrashed()
            ->where('marketplace_id', $marketplaceId)
            ->whereRaw('LOWER(code) = ?', [mb_strtolower((string) $data['code'])])
            ->when($store, fn ($query) => $query->whereKeyNot($store->id))
            ->exists();

        if ($duplicate) {
            $this->error = 'Kode toko ini sudah dipakai pada marketplace yang sama, termasuk toko yang sudah dihapus.';

            return;
        }

        try {
            $saved = DB::transaction(function () use ($store, $data): Store {
                if ($store) {
                    $store->fill($data)->save();

                    return $store->refresh();
                }

                return Store::query()->create($data);
            });

            $this->replace('/stores/'.$saved->id);
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Toko gagal disimpan. Periksa data lalu coba lagi.');
        }
    }
}
