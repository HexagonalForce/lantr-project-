async function loadContent() {
  const response = await fetch("content.json");
  if (!response.ok) throw new Error("Content could not be loaded");
  return response.json();
}

function renderContent(content) {
  document.title = content.name;
  document.querySelector("#intro").textContent = content.intro;
  document.querySelector("#school-name").textContent = content.school;
  document.querySelector("#school-year").textContent = content.year;
  document.querySelector("#class-name").textContent = content.class;
  document.querySelector("#now-list").innerHTML = content.now.map((item, index) => `
    <article class="now-card now-card-${index + 1}">
      <span>${item.label}</span>
      <h3>${item.title}</h3>
      <p>${item.text}</p>
      <b aria-hidden="true">0${index + 1}</b>
    </article>`).join("");
  document.querySelector("#focus-list").innerHTML = content.focus.map((item, index) => `
    <article class="focus-item">
      <span class="focus-number">0${index + 1}</span>
      <h3>${item.title}</h3>
      <p>${item.text}</p>
    </article>`).join("");
  document.querySelector("#opportunity-list").innerHTML = content.opportunities.map(item => `
    <article class="opportunity">
      <span class="opportunity-type">${item.type}</span>
      <h3>${item.title}</h3>
      <p>${item.text}</p>
      <span class="status">${item.status}</span>
    </article>`).join("");
  document.querySelector("#weekly-list").innerHTML = content.weekly.map(item => `
    <article class="weekly-item">
      <span class="weekly-number">${item.number}</span>
      <div><h3>${item.title}</h3><p>${item.text}</p></div>
      <span class="weekly-date">${item.date}</span>
    </article>`).join("");
}

loadContent().then(renderContent).catch(() => {
  document.querySelector("#intro").textContent = "Aaron Yu — student, saxophonist, gamer, and French learner based in Auckland.";
});
document.querySelector("#year").textContent = new Date().getFullYear();
