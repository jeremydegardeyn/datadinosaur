</main>

<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <img src="/assets/images/data_dinosaur.svg" alt="DataDinosaur" height="32">
      <p class="footer-tagline"><?= e($config['site']['tagline']) ?></p>
    </div>

    <nav class="footer-nav">
      <?php foreach ($config['footer']['links'] as $link): ?>
      <a href="<?= e($link['href']) ?>"><?= e($link['label']) ?></a>
      <?php endforeach; ?>
    </nav>

    <?php if (!empty($config['footer']['social'])): ?>
    <div class="footer-social">
      <?php foreach ($config['footer']['social'] as $s): ?>
      <a href="<?= e($s['href']) ?>" target="_blank" rel="noopener"><?= e($s['label']) ?></a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <p class="footer-copy">
      &copy; <?= $config['site']['copyright_year'] ?> <?= e($config['site']['name']) ?>.
      Real humans, real expertise.
    </p>
  </div>
</footer>

<script src="/assets/js/main.js?v=1"></script>
</body>
</html>
