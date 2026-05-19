const DIFFICULTY = {
  easy:   { pairs: 3,  time: 60  },
  medium: { pairs: 6,  time: 90  },
  hard:   { pairs: 10, time: 120 },
};

let firstCard    = undefined;
let secondCard   = undefined;
let locked       = false;
let gameOver     = false;
let gameStarted  = false;

let clicks       = 0;
let matchedPairs = 0;
let totalPairs   = 0;

let timerInterval = null;
let timeLeft      = 0;

let peekUsed      = false;
let peekOnCooldown = false;

const $grid      = $("#game_grid");
const $startBtn  = $("#start_btn");
const $resetBtn  = $("#reset_btn");
const $peekBtn   = $("#peek_btn");
const $themeBtn  = $("#theme_btn");
const $overlay   = $("#message_overlay");
const $loading   = $("#loading_msg");

function updateStatus() {
  const remaining = totalPairs - matchedPairs;
  $("#stat_clicks").text(clicks);
  $("#stat_matched").text(matchedPairs);
  $("#stat_remaining").text(remaining);
  $("#stat_total").text(totalPairs);
  $("#stat_timer").text(timeLeft);


  $(".timer-box").toggleClass("warn", timeLeft <= 15 && gameStarted && !gameOver);
}


function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateStatus();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      triggerLose();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}


function triggerWin() {
  gameOver = true;
  stopTimer();
  $(".timer-box").removeClass("warn");

  const timeTaken = DIFFICULTY[getSelectedDifficulty()].time - timeLeft;
  showMessage(
    "win",
    "🎉",
    "You Win!",
    `You matched all ${totalPairs} pairs in ${timeTaken}s with ${clicks} clicks!`
  );
}

function triggerLose() {
  gameOver = true;
  $(".card:not(.matched)").removeClass("flip peeking");
  $(".timer-box").removeClass("warn");

  showMessage(
    "lose",
    "dead",
    "Game Over!",
    `Time's up! You matched ${matchedPairs} of ${totalPairs} pairs.`
  );
}

function showMessage(type, icon, title, body) {
  $("#message_icon").text(icon);
  $("#message_title").text(title);
  $("#message_body").text(body);
  $overlay.show();
  $("#message_box").removeClass("win lose").addClass(type);
}


async function fetchRandomPokemon(count) {
  const listRes  = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
  const listData = await listRes.json();
  const all      = listData.results;

  const shuffled  = all.sort(() => Math.random() - 0.5);
  const chosen    = shuffled.slice(0, count);


  const detailPromises = chosen.map(p => fetch(p.url).then(r => r.json()));
  const details        = await Promise.all(detailPromises);


  return details.map(d => ({
    name: d.name,
    img:  d.sprites.other["official-artwork"].front_default,
  }));
}


function buildCards(pokemonList) {
  $grid.empty();


  const cardData = [...pokemonList, ...pokemonList]
    .sort(() => Math.random() - 0.5);

  cardData.forEach((poke, i) => {
    const cardId = `card_${i}`;
    const $card = $(`
      <div class="card" id="${cardId}" data-img="${poke.img}" data-name="${poke.name}">
        <div class="card-inner">
          <div class="front_face">
            <img src="${poke.img}" alt="${poke.name}" />
            <span class="poke_name">${poke.name}</span>
          </div>
          <div class="back_face">
            <img src="back.webp" alt="Card back" />
          </div>
        </div>
      </div>
    `);

    $card.on("click", handleCardClick);
    $grid.append($card);
  });
}


function handleCardClick() {
  if (!gameStarted)          return;
  if (gameOver)              return;
  if (locked)                return;
  if ($(this).hasClass("flip"))    return;
  if ($(this).hasClass("matched")) return;

  $(this).addClass("flip");
  clicks++;
  updateStatus();

  if (!firstCard) {
    firstCard = $(this);
  } else {
    secondCard = $(this);
    locked = true;

    const img1 = firstCard.data("img");
    const img2 = secondCard.data("img");

    if (img1 === img2) {
      firstCard.addClass("matched").off("click");
      secondCard.addClass("matched").off("click");
      matchedPairs++;
      updateStatus();
      resetTurn();

      if (matchedPairs === totalPairs) {
        setTimeout(triggerWin, 400);
      }
    } else {
      const $a = firstCard;
      const $b = secondCard;
      setTimeout(() => {
        $a.removeClass("flip");
        $b.removeClass("flip");
        resetTurn();
      }, 1000);
    }
  }
}

function resetTurn() {
  firstCard  = undefined;
  secondCard = undefined;
  locked     = false;
}

function triggerPeek() {
  if (peekOnCooldown || !gameStarted || gameOver) return;

  peekOnCooldown = true;
  $peekBtn.prop("disabled", true).text("👁 Peeking...");


  $(".card:not(.matched)").addClass("peeking");


  locked = true;

  setTimeout(() => {
    $(".card:not(.matched)").removeClass("peeking");
    locked = false;
    $peekBtn.text("👁 Peek! (used)").prop("disabled", true);
    peekUsed = true;
  }, 2000);
}


function getSelectedDifficulty() {
  return $("input[name='difficulty']:checked").val() || "easy";
}


async function startGame() {
  const diff = getSelectedDifficulty();
  const { pairs, time } = DIFFICULTY[diff];


  $("body").removeClass("easy medium hard").addClass(diff);


  firstCard    = undefined;
  secondCard   = undefined;
  locked       = false;
  gameOver     = false;
  gameStarted  = false;
  clicks       = 0;
  matchedPairs = 0;
  totalPairs   = pairs;
  timeLeft     = time;
  peekUsed     = false;
  peekOnCooldown = false;

  stopTimer();
  $overlay.hide();
  $(".timer-box").removeClass("warn");
  $peekBtn.text("👁 Peek!").prop("disabled", false);
  updateStatus();

  $startBtn.prop("disabled", true);
  $resetBtn.prop("disabled", true);
  $peekBtn.prop("disabled", true);
  $grid.empty();
  $loading.show();

  try {
    const pokemon = await fetchRandomPokemon(pairs);
    buildCards(pokemon);
  } catch (err) {
    $grid.html(`<p style="color:red;padding:40px;text-align:center;font-weight:bold;">
      ⚠️ Could not load Pokémon. Check your connection and try again.<br><small>${err.message}</small>
    </p>`);
    $startBtn.prop("disabled", false);
    $loading.hide();
    return;
  }

  $loading.hide();
  gameStarted = true;
  startTimer();

  $startBtn.prop("disabled", false);
  $resetBtn.prop("disabled", false);
  $peekBtn.prop("disabled", false);
}

function resetGame() {
  startGame();
}

function toggleTheme() {
  const isDark = $("body").hasClass("dark");
  $("body").toggleClass("dark", !isDark).toggleClass("light", isDark);
  $themeBtn.text(isDark ? "🌙 Dark Mode" : "☀️ Light Mode");
}


$(document).ready(function () {
  $startBtn.on("click", startGame);
  $resetBtn.on("click", resetGame);
  $peekBtn.on("click",  triggerPeek);
  $themeBtn.on("click", toggleTheme);


  $("#msg_play_again").on("click", function () {
    $overlay.hide();
    startGame();
  });


  $("input[name='difficulty']").on("change", function () {
    if (gameStarted) startGame();
  });


  updateStatus();
});