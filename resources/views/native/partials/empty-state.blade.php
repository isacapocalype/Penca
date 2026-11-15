@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:column class="w-full items-center gap-3 rounded-3xl bg-theme-surface border border-theme-outline px-6 py-8">
    <native:column class="h-14 w-14 items-center justify-center rounded-full bg-theme-primary-soft">
        <native:icon :ios="Ios::Tray" :android="Android::Inventory" :size="26" class="text-theme-primary-text" />
    </native:column>
    <native:text class="text-center text-base text-theme-on-surface" font="heading">{{ $title ?? 'Belum ada data' }}</native:text>
    <native:text class="text-center text-sm text-theme-secondary">{{ $message ?? 'Data akan muncul setelah transaksi pertama dicatat.' }}</native:text>
    @if (! empty($ctaLabel) && ! empty($ctaUrl))
        <native:button class="mt-1 w-full" variant="primary" @navigate="$ctaUrl">{{ $ctaLabel }}</native:button>
    @endif
</native:column>
