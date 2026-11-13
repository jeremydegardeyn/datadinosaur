<?php
// Reusable email signup form. Set $subscribe_source before including to
// record where the signup came from (e.g. "footer", "post:<slug>").
$subscribe_source = $subscribe_source ?? 'site';
$sub_ts   = time();
$sub_tsig = hash_hmac('sha256', (string)$sub_ts, getenv('APP_SECRET') ?: 'dd');
?>
<form class="subscribe-form" method="POST" action="/api/subscribe">
  <input type="hidden" name="action" value="subscribe">
  <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
  <input type="hidden" name="source" value="<?= e($subscribe_source) ?>">
  <input type="hidden" name="ts" value="<?= $sub_ts ?>">
  <input type="hidden" name="tsig" value="<?= e($sub_tsig) ?>">
  <label class="visually-hidden" for="sub-<?= e(md5($subscribe_source)) ?>">Email address</label>
  <input type="email" name="email" id="sub-<?= e(md5($subscribe_source)) ?>" required maxlength="200"
         placeholder="you@company.com" autocomplete="email">
  <input type="text" name="website" tabindex="-1" autocomplete="off" class="hp-field" aria-hidden="true">
  <button type="submit" class="btn btn-primary">Subscribe</button>
</form>
