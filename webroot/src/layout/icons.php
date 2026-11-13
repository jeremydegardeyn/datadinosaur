<?php
declare(strict_types=1);

/**
 * Inline SVG icons: 24x24 outline, 2px stroke, currentColor, so they take the
 * surrounding text colour in both themes. Drawn for this site in the style of
 * the Tabler set; one consistent family instead of emoji, which render
 * differently on every device.
 */
function icon(string $name, int $size = 24, string $class = 'icon'): string
{
    static $paths = [
        'gateway'   => '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 6h3a3 3 0 0 1 3 3v0a3 3 0 0 0 3 3h1"/><path d="M7 18h3a3 3 0 0 0 3 -3v0a3 3 0 0 1 3 -3"/>',
        'shield'    => '<path d="M12 3l8 3.5v5.5c0 4.6 -3.4 8.3 -8 9c-4.6 -.7 -8 -4.4 -8 -9v-5.5z"/><path d="M9 12l2 2l4 -4"/>',
        'database'  => '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8 -1.3 8 -3v-6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8 -1.3 8 -3v-6"/>',
        'agent'     => '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8v-3"/><circle cx="12" cy="4" r="1"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M10 17h4"/><path d="M2 13v2"/><path d="M22 13v2"/>',
        'growth'    => '<path d="M4 19h16"/><path d="M4 15l5 -5l4 3l7 -7"/><path d="M15 6h5v5"/>',
        'users'     => '<circle cx="9" cy="8" r="3"/><path d="M3 20c0 -3.3 2.7 -6 6 -6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6"/><path d="M18 14.5c1.8 .8 3 2.8 3 5.5"/>',
        'search'    => '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5 -4.5"/>',
        'checklist' => '<path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/><path d="M4 6l1.5 1.5l2.5 -2.5"/><path d="M4 12l1.5 1.5l2.5 -2.5"/><path d="M4 18l1.5 1.5l2.5 -2.5"/>',
        'layers'    => '<path d="M12 4l8 4l-8 4l-8 -4z"/><path d="M4 12l8 4l8 -4"/><path d="M4 16l8 4l8 -4"/>',
        'lock'      => '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11v-4a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1"/>',
        'gamepad'   => '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10.5v4"/><path d="M5 12.5h4"/><path d="M15 11.5h.01"/><path d="M18 13.5h.01"/>',
        'book'      => '<path d="M5 4h11a3 3 0 0 1 3 3v13h-12a2 2 0 0 1 -2 -2z"/><path d="M5 18a2 2 0 0 1 2 -2h12"/><path d="M9 8h6"/>',
        'rss'       => '<circle cx="5" cy="19" r="1"/><path d="M4 4a16 16 0 0 1 16 16"/><path d="M4 11a9 9 0 0 1 9 9"/>',
        'mail'      => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6l9 -6"/>',
        'sun'       => '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4 -1.4M17.7 6.3l1.4 -1.4"/>',
        'moon'      => '<path d="M12 3a6 6 0 0 0 9 9a9 9 0 1 1 -9 -9z"/>',
        'arrow'     => '<path d="M5 12h14"/><path d="M13 6l6 6l-6 6"/>',
        'flask'     => '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7 -3l-5 -9v-6"/><path d="M7.5 14h9"/>',
        'kana'      => '<path d="M6 6h9"/><path d="M10 3c0 6 -2 11 -5 15"/><path d="M13 9c2 0 5 1.5 5 5s-3 5 -6 5"/>',
        'guitar'    => '<path d="M14 10l5 -5"/><path d="M17 3l4 4"/><path d="M10.5 9.5c-2 -1 -4.5 -.5 -5.8 1.2c-1 1.3 -.6 2.6 -1.7 3.6c-1.4 1.4 -.8 4.2 1.3 5.4c2.1 1.3 4.8 .3 5.6 -1.4c.6 -1.2 1.9 -1 3 -2.1c1.6 -1.6 1.8 -4 .6 -5.9z"/><circle cx="9" cy="15" r="1.5"/>',
    ];
    $p = $paths[$name] ?? $paths['layers'];
    return '<svg class="' . htmlspecialchars($class, ENT_QUOTES) . '" width="' . $size . '" height="' . $size
         . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'
         . ' stroke-linejoin="round" aria-hidden="true" focusable="false">' . $p . '</svg>';
}
