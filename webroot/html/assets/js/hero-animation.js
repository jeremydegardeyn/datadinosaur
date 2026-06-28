/* DataDinosaur — hero-animation.js
   Reveals the hero tagline shortly after load. (Matrix rain removed.)
   Dino logo is fully static.
*/
'use strict';

(function () {
  var tagline = document.getElementById('hero-tagline');
  if (!tagline) return;
  setTimeout(function () { tagline.classList.add('visible'); }, 1200);
})();
