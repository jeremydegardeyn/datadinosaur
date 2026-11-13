<?php
declare(strict_types=1);

/**
 * Per-post 1200x630 share image (Open Graph / LinkedIn / X). Generated once
 * with GD on first render, cached under html/assets/uploads/og/, and served by
 * nginx as a static file from then on. The file name carries a hash of the
 * title and category, so a retitled post gets a fresh image (and a fresh URL,
 * which also busts LinkedIn's preview cache).
 *
 * Returns the site-relative URL, or null if GD/fonts aren't available (the
 * caller then falls back to the default site image).
 */
function dd_post_og_image(array $post, array $config): ?string
{
    $font_bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    $font_reg  = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
    if (!function_exists('imagettftext') || !is_file($font_bold) || !is_file($font_reg)) return null;

    $category = (string)($post['category_name'] ?? '');
    $hash     = substr(md5('v4|' . $post['title'] . '|' . $category), 0, 10);
    $name     = preg_replace('/[^a-z0-9-]/', '', (string)$post['slug']);
    $name     = substr($name, 0, 80) . '-' . $hash . '.png';
    $dir      = APP_ROOT . '/html/assets/uploads/og';
    $url      = '/assets/uploads/og/' . $name;
    if (is_file($dir . '/' . $name)) return $url;
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) return null;

    $W = 1200; $H = 630;
    $im = imagecreatetruecolor($W, $H);
    imagealphablending($im, true);

    // The logo is cropped from the default share image (light-text wordmark;
    // data_dinosaur.png has dark text). Use that image's own background colour
    // for the canvas so the crop has no visible edge.
    $logo_file = APP_ROOT . '/html/assets/images/data_dinosaur_og.png';
    $logo      = is_file($logo_file) ? @imagecreatefrompng($logo_file) : false;
    [$br, $bgc, $bb] = [15, 17, 23];
    if ($logo) {
        $c = imagecolorsforindex($logo, imagecolorat($logo, 10, 10));
        [$br, $bgc, $bb] = [$c['red'], $c['green'], $c['blue']];
    }
    $bg     = imagecolorallocate($im, $br, $bgc, $bb);
    $panel  = imagecolorallocate($im, min(255, $br + 12), min(255, $bgc + 12), min(255, $bb + 16));
    $green  = imagecolorallocate($im, 16, 185, 129);
    $amber  = imagecolorallocate($im, 245, 158, 11);
    $white  = imagecolorallocate($im, 240, 244, 255);
    $muted  = imagecolorallocate($im, 160, 170, 188);
    imagefilledrectangle($im, 0, 0, $W, $H, $bg);
    imagefilledrectangle($im, 0, 0, 14, $H, $green);
    imagefilledrectangle($im, 14, $H - 110, $W, $H, $panel);

    if ($logo) {
        [$sx, $sy, $sw, $sh] = [150, 205, 900, 215];
        $lw = 260; $lh = (int)round($sh * $lw / $sw);
        imagecopyresampled($im, $logo, 70, 52, $sx, $sy, $lw, $lh, $sw, $sh);
        imagedestroy($logo);
    }

    // Category label.
    $y = 200;
    if ($category !== '') {
        imagettftext($im, 22, 0, 72, $y, $green, $font_bold, mb_strtoupper($category));
        $y += 30;
    }

    // Title: largest size (64 → 40) that fits in 4 lines.
    $title = trim((string)$post['title']);
    $maxw  = $W - 72 - 80;
    $lines = [];
    $size  = 64;
    for (; $size >= 40; $size -= 4) {
        $lines = dd_wrap_ttf($title, $font_bold, $size, $maxw);
        if (count($lines) <= 4) break;
    }
    if (count($lines) > 4) {
        $lines = array_slice($lines, 0, 4);
        $lines[3] = rtrim($lines[3], ' .,;:') . '…';
    }
    $lh = (int)round($size * 1.28);
    $y += $lh;
    foreach ($lines as $ln) {
        imagettftext($im, $size, 0, 70, $y, $white, $font_bold, $ln);
        $y += $lh;
    }

    // Footer strip: author, read time, domain.
    $author = author_name($post, $config);
    $rt     = reading_time((string)($post['content'] ?? '')) . ' min read';
    imagettftext($im, 24, 0, 72, $H - 46, $white, $font_bold, $author);
    $bb = imagettfbbox(24, 0, $font_bold, $author);
    imagettftext($im, 22, 0, 72 + ($bb[2] - $bb[0]) + 24, $H - 47, $muted, $font_reg, '·  ' . $rt);
    $domain = 'datadinosaur.com';
    $db = imagettfbbox(22, 0, $font_bold, $domain);
    imagettftext($im, 22, 0, $W - 70 - ($db[2] - $db[0]), $H - 47, $amber, $font_bold, $domain);

    $ok = imagepng($im, $dir . '/' . $name, 6);
    imagedestroy($im);
    if (!$ok) return null;
    @chmod($dir . '/' . $name, 0644);
    return $url;
}

/** Greedy word-wrap for a TrueType font. */
function dd_wrap_ttf(string $text, string $font, int $size, int $maxw): array
{
    $words = preg_split('/\s+/u', $text) ?: [];
    $lines = [];
    $cur   = '';
    foreach ($words as $w) {
        $try = $cur === '' ? $w : $cur . ' ' . $w;
        $bb  = imagettfbbox($size, 0, $font, $try);
        if (($bb[2] - $bb[0]) <= $maxw || $cur === '') {
            $cur = $try;
        } else {
            $lines[] = $cur;
            $cur = $w;
        }
    }
    if ($cur !== '') $lines[] = $cur;
    return $lines;
}

/**
 * Shrink an uploaded still image in place: cap the width at 1600px and
 * re-encode PNG/JPEG as WebP when that is smaller. GIFs are left alone (GD
 * would drop animation frames). Returns [new path, new extension].
 */
function dd_optimize_upload(string $path, string $ext): array
{
    if (!in_array($ext, ['png', 'jpg', 'webp'], true)) return [$path, $ext];
    $info = @getimagesize($path);
    if (!$info) return [$path, $ext];
    [$w, $h] = $info;

    $src = match ($ext) {
        'png'  => @imagecreatefrompng($path),
        'jpg'  => @imagecreatefromjpeg($path),
        'webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
    };
    if (!$src) return [$path, $ext];

    $max = 1600;
    if ($w > $max) {
        $nh  = (int)round($h * $max / $w);
        $dst = imagecreatetruecolor($max, $nh);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $max, $nh, $w, $h);
        imagedestroy($src);
        $src = $dst;
    } else {
        imagealphablending($src, false);
        imagesavealpha($src, true);
    }

    $out_path = $path;
    $out_ext  = $ext;
    if (function_exists('imagewebp')) {
        $webp = preg_replace('/\.[a-z]+$/', '.webp', $path);
        if (imagewebp($src, $webp, 82) && (filesize($webp) < filesize($path) || $w > $max)) {
            if ($webp !== $path) @unlink($path);
            $out_path = $webp;
            $out_ext  = 'webp';
        } elseif ($webp !== $path) {
            @unlink($webp);
        }
    } elseif ($w > $max) {
        // No WebP support: at least write the resized image back.
        $ext === 'png' ? imagepng($src, $path, 6) : imagejpeg($src, $path, 85);
    }
    imagedestroy($src);
    return [$out_path, $out_ext];
}
