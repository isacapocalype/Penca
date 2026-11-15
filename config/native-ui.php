<?php

/**
 * Penca — token visual.
 *
 * Putih hangat sebagai kanvas, amber sebagai aksen. Token di bawah adalah
 * sumber warna untuk komponen native. Komponen yang membutuhkan nuansa di
 * luar token memakai kelas Tailwind arbitrer agar tetap satu bahasa desain.
 */
return [

    'theme' => [

        'light' => [
            'primary' => '#FFA500',
            'on-primary' => '#1C1C1E',
            'primary-soft' => '#FFF4E0',
            'primary-text' => '#8A4B00',

            'secondary' => '#6E6E73',
            'on-secondary' => '#FFFFFF',

            'surface' => '#FFFFFF',
            'on-surface' => '#1C1C1E',
            'background' => '#FAF9F6',
            'on-background' => '#1C1C1E',

            'surface-variant' => '#FFF4E0',
            'on-surface-variant' => '#6E6E73',

            'outline' => '#E8E2D6',
            'border-subtle' => '#1C1C1E14',
            'border-glass' => '#FFFFFFBF',
            'glass' => '#FFFFFF9E',
            'glass-strong' => '#FFFFFFDB',

            'destructive' => '#D64545',
            'on-destructive' => '#FFFFFF',
            'danger-soft' => '#FDECEC',

            'success' => '#1F9D55',
            'on-success' => '#FFFFFF',
            'success-soft' => '#E8F7EE',

            'warning' => '#FFA500',
            'on-warning' => '#1C1C1E',
            'warning-soft' => '#FFF4E0',

            'info' => '#2D7FF9',
            'on-info' => '#FFFFFF',
            'info-soft' => '#EAF2FF',

            'muted' => '#9A9AA0',

            'accent' => '#8A4B00',
            'on-accent' => '#FFFFFF',
        ],

        'dark' => [
            'primary' => '#FFB84D',
            'on-primary' => '#1C1C1E',
            'primary-soft' => '#3A2A0F',
            'primary-text' => '#FFD580',
            'secondary' => '#A1A1A6',
            'on-secondary' => '#1C1C1E',
            'surface' => '#1F1E1A',
            'on-surface' => '#F3F0E9',
            'background' => '#141310',
            'on-background' => '#F3F0E9',
            'surface-variant' => '#2A2720',
            'on-surface-variant' => '#A1A1A6',
            'outline' => '#3A362D',
            'border-subtle' => '#F3F0E91A',
            'border-glass' => '#FFFFFF24',
            'glass' => '#1F1E1A9E',
            'glass-strong' => '#1F1E1ADB',
            'destructive' => '#F87171',
            'on-destructive' => '#1C1C1E',
            'danger-soft' => '#3A1A1A',
            'success' => '#4ADE80',
            'on-success' => '#0F2417',
            'success-soft' => '#12301F',
            'warning' => '#FFB84D',
            'on-warning' => '#1C1C1E',
            'warning-soft' => '#3A2A0F',
            'info' => '#7FB3FF',
            'on-info' => '#0E1A2B',
            'info-soft' => '#16233A',
            'muted' => '#8E8E93',
            'accent' => '#FFD580',
            'on-accent' => '#1C1C1E',
        ],

        'radius-sm' => 12,
        'radius-md' => 16,
        'radius-lg' => 24,
        'radius-full' => 9999,

        'font-sm' => 13,
        'font-md' => 15,
        'font-lg' => 20,
        'font-xl' => 28,
    ],

    'fonts' => [
        'default' => 'Inter-Regular',
        'body-medium' => 'Inter-Medium',
        'body-semibold' => 'Inter-SemiBold',
        'heading' => 'PlusJakartaSans-SemiBold',
        'heading-bold' => 'PlusJakartaSans-Bold',
    ],

];
