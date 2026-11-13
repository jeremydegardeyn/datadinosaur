<?php
$state = match (true) {
    isset($_GET['confirmed'])    => 'confirmed',
    isset($_GET['pending'])      => 'pending',
    isset($_GET['unsubscribed']) => 'unsubscribed',
    isset($_GET['error'])        => 'error',
    default                      => 'form',
};
if ($state !== 'form') $seo_noindex = true;
?>
<section class="page-head container">
  <h1><?= match ($state) {
      'confirmed'    => "You're subscribed",
      'pending'      => 'Check your inbox',
      'unsubscribed' => "You're unsubscribed",
      default        => 'Get new posts by email',
  } ?></h1>
</section>

<section class="container narrow-section">
  <?php if ($state === 'confirmed'): ?>
  <p class="page-lead">Thanks for confirming. You'll get one email each time a new post goes up.</p>
  <div class="resource-callout">
    <h2>Your RAG security checklist</h2>
    <p>Ten checks for a retrieval-augmented system: access control, prompt injection, PII, audit logging,
       evals, caching, and agent tool risk. It prints to a single page.</p>
    <a class="btn btn-primary" href="/resources/rag-security-checklist">Open the checklist</a>
  </div>
  <p><a href="/start-here">New here? Start with these posts &rarr;</a></p>

  <?php elseif ($state === 'pending'): ?>
  <p class="page-lead">If that address isn't already on the list, a confirmation link is on its way.
     Click it to finish subscribing. Check spam if it hasn't arrived in a few minutes.</p>
  <p><a href="/blog">Back to the blog &rarr;</a></p>

  <?php elseif ($state === 'unsubscribed'): ?>
  <p class="page-lead">You won't get any more emails. If that was a mistake, you can subscribe again below.</p>
  <?php $subscribe_source = 'resubscribe'; require SRC_ROOT . '/layout/subscribe-form.php'; ?>

  <?php else: ?>
  <?php if ($state === 'error'): ?>
  <div class="alert alert-error">That email address didn't look right. Please try again.</div>
  <?php endif; ?>
  <p class="page-lead">One email when a new post goes up: hands-on write-ups on AI gateways, agent governance,
     evals, RAG, and data platforms. No tracking pixels, no sharing your address, unsubscribe in one click.</p>
  <?php $subscribe_source = 'subscribe-page'; require SRC_ROOT . '/layout/subscribe-form.php'; ?>
  <p class="field-note" style="margin-top:1rem">After you confirm, you'll get a link to the
     <a href="/resources/rag-security-checklist">RAG security checklist</a>. Prefer a feed reader?
     Use <a href="/feed.xml">the RSS feed</a>.</p>
  <?php endif; ?>
</section>
