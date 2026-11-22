const copyrightYear = document.getElementById('copyright-year');
const singaporeYear = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  year: 'numeric',
});

function updateCopyrightYear() {
  copyrightYear.textContent = singaporeYear.format(new Date());
}

updateCopyrightYear();
window.addEventListener('pageshow', updateCopyrightYear);
