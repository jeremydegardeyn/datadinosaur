<?php
$consulting_types = $config['contact']['consulting_types'];
?>
<div class="container page-content">
  <div class="contact-wrap">
    <div class="contact-intro">
      <h1 class="page-heading">Get in Touch</h1>
      <p class="page-lead">
        Whether you're looking for consulting help, have a question about a post,
        or just want to talk data engineering — I'd love to hear from you.
      </p>
      <p>
        <strong>Email directly:</strong>
        <a href="mailto:<?= e($config['contact']['email']) ?>"><?= e($config['contact']['email']) ?></a>
      </p>
    </div>

    <?php if (isset($_GET['success'])): ?>
    <div class="alert alert-success">
      Message sent! I'll get back to you within 1-2 business days.
    </div>
    <?php elseif (isset($_GET['error'])): ?>
    <div class="alert alert-error">
      Something went wrong sending your message. Please email me directly.
    </div>
    <?php endif; ?>

    <form method="POST" action="/api/contact" class="contact-form" id="contactForm">
      <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
      <!-- Honeypot -->
      <div style="display:none" aria-hidden="true">
        <input type="text" name="website" tabindex="-1" autocomplete="off">
      </div>

      <div class="form-row">
        <label>Name *
          <input type="text" name="name" required maxlength="150">
        </label>
        <label>Email *
          <input type="email" name="email" required maxlength="200">
        </label>
      </div>

      <div class="form-row">
        <label>Company
          <input type="text" name="company" maxlength="200" placeholder="Optional">
        </label>
        <label>Type of inquiry
          <select name="type">
            <?php foreach ($consulting_types as $t): ?>
            <option value="<?= e($t) ?>"><?= e($t) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
      </div>

      <label>Subject *
        <input type="text" name="subject" required maxlength="300">
      </label>

      <label>Message *
        <textarea name="message" rows="6" required maxlength="5000"
                  placeholder="Tell me what you're working on..."></textarea>
      </label>

      <button type="submit" class="btn btn-primary">Send Message</button>
    </form>
  </div>
</div>
