const portfolioLink = document.querySelector('.portfolio-return');
const returnHoldDuration = 1000;
portfolioLink.style.setProperty("--return-hold-duration", `${returnHoldDuration}ms`);
let returnTimer;
function cancelReturn() {
  clearTimeout(returnTimer);
  returnTimer = undefined;
  portfolioLink.classList.remove('holding');
}
addEventListener('keydown', event => {
  if (event.code !== 'Escape' || event.repeat || returnTimer !== undefined) return;
  event.preventDefault();
  portfolioLink.classList.add('holding');
  returnTimer = setTimeout(() => location.assign(portfolioLink.href), returnHoldDuration);
});
addEventListener('keyup', event => {
  if (event.code === 'Escape') cancelReturn();
});
addEventListener('blur', cancelReturn);
addEventListener('pagehide', cancelReturn);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelReturn();
});

// Tapping a card reveals the same overlay as hover and keyboard focus.
for(const card of document.querySelectorAll(".game-card"))card.addEventListener("click",event=>{if(!event.target.closest("a"))card.focus({preventScroll:true});});
