const FRAME_INTERVAL = 100; // ms 每幀間隔

// 主要角色物件
let mainChar = {
  sprites: {},
  currentKey: 'stance',
  frameW: 0,
  frameH: 0,
  currentFrame: 0,
  lastChange: 0,
  x: 0, // 角色中心 X 位置
  y: 0, // 角色中心 Y 位置
  velocityX: 0, // X 方向速度
  velocityY: 0, // Y 方向速度
  isWalking: false, // 是否正在行走
  facingRight: true, // 角色朝向（true=右, false=左）
  prevKey: null // 用來暫存切換前的 key，以便放開滑鼠還原
};

// 統一定義所有 NPC
let npcs = {
  // 精靈2
  sideChar: {
    sprite: {}, frameW: 0, frameH: 0, currentFrame: 0, lastChange: 0, x: 0, y: 0,
    facingRight: true,
    isInteractive: true,
    questionRange: { start: 1, end: 4 }, // Qs 2-5
    correctCount: 0 // 答對次數
  },
  // 精靈5
  bottomLeftChar: {
    sprites: {}, currentKey: 'default', frameW: 0, frameH: 0, currentFrame: 0, lastChange: 0, x: 0, y: 0,
    facingRight: true,
    velocityX: 0, velocityY: 0, lastMoveChange: 0,
    isInteractive: false
  },
  // 精靈3
  topLeftChar: {
    sprite: {}, frameW: 0, frameH: 0, currentFrame: 0, lastChange: 0, x: 0, y: 0,
    facingRight: true,
    isInteractive: true,
    questionRange: { start: 5, end: 9 }, // Qs 6-10
    correctCount: 0 // 答對次數
  },
  // 精靈4
  bottomRightChar: {
    sprite: {}, frameW: 0, frameH: 0, currentFrame: 0, lastChange: 0, x: 0, y: 0,
    facingRight: false,
    isInteractive: true,
    questionRange: { start: 10, end: 14 }, // Qs 11-15
    correctCount: 0 // 答對次數
  }
};

let questionTable;
let questions = [];
let currentQuestion = null; // 儲存當前問題的完整物件
let activeNPC = null; // 儲存當前互動的 NPC
let character2Dialogue = "";
let dialogueVisible = false;
let lastCollisionTime = 0;
let feedbackTimer = null; // 用於計時回饋訊息的顯示
const COLLISION_COOLDOWN = 2000; // 2秒冷卻時間
const WALK_SPEED = 8; // 移動速度（像素/幀）
let score = 0; // 分數  
let lives = 4; // 生命值
let gameState = 0; // 0=介紹頁, 1=第一頁, 2=第二頁
let shakeEndTime = 0; // 震動結束時間
let flashEndTime = 0; // 閃爍結束時間
let fireworks = []; // 煙火陣列

let answerInput; // 文字輸入框
let optionButtons = []; // 選項按鈕
let bgImg; // 背景圖片
let restartButton; // 重玩按鈕
let startButton; // 開始按鈕

function preload() {
  // 主要站立精靈（10 幀）
  mainChar.sprites['stance'] = {
    img: loadImage('1/stance/all.png'),
    frames: 10
  };

  // 右鍵按下時要切換的精靈（6 幀）
  mainChar.sprites['walk'] = {
    img: loadImage('1/walk/all.png'),
    frames: 6
  };

  // slash 精靈（5 幀），來源檔案 1/slash/all.png，總寬 755 總高 140
  // 每格寬度 = 755 / 5 = 151
  mainChar.sprites['slash'] = {
    img: loadImage('1/slash/all.png'),
    frames: 5,
    frameW: 755 / 5,
    frameH: 140
  };

  // 新增左側角色的精靈
  npcs.sideChar.sprite = {
    img: loadImage('2/stand/all.png'),
    frames: 12,
    frameW: 7003 / 12,
    frameH: 120
  };

  // 載入題庫 CSV
  questionTable = loadTable('questions.csv', 'csv', 'header');

  // 新增左下角角色的精靈
  npcs.bottomLeftChar.sprites['default'] = {
    img: loadImage('5/bb/all.png'),
    frames: 6,
    frameW: 433 / 6,
    frameH: 52
  };
  // 答錯時的變身精靈
  npcs.bottomLeftChar.sprites['transform'] = {
    img: loadImage('5/aa/all.png'),
    frames: 9,
    frameW: 751 / 9,
    frameH: 88
  };

  // 新增左上角角色的精靈
  npcs.topLeftChar.sprite = {
    img: loadImage('3/stand/all.png'),
    frames: 6,
    frameW: 439 / 6,
    frameH: 137
  };

  // 新增右下角角色的精靈
  npcs.bottomRightChar.sprite = {
    img: loadImage('4/stand/all.png'),
    frames: 11,
    frameW: 897 / 11,
    frameH: 107
  };

  // 載入背景圖片
  bgImg = loadImage('森林/森林.jpg');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();

  // 初始化主要角色
  updateFrameSize(mainChar);
  mainChar.lastChange = millis();
  mainChar.x = width / 2; // 初始位置：螢幕中央
  mainChar.y = height / 2 + 220;

  // 建立輸入框並隱藏
  answerInput = createInput();
  answerInput.size(150);
  answerInput.hide();
  answerInput.elt.style.textAlign = 'center'; // 讓輸入文字置中

  // 建立選項按鈕
  for (let i = 0; i < 4; i++) {
    let btn = createButton('');
    btn.size(80, 40); // 改為較方正的大小以適應 2x2 排列
    btn.hide();
    btn.mousePressed(() => checkAnswer(String.fromCharCode(65 + i))); // 傳入 A, B, C, D
    btn.style('cursor', 'pointer');
    btn.style('background-color', '#fff');
    btn.style('border', '1px solid #000');
    btn.style('border-radius', '5px');
    optionButtons.push(btn);
  }

  // 建立重玩按鈕
  restartButton = createButton('重新開始');
  restartButton.size(150, 50);
  restartButton.position(width / 2 - 75, height / 2 + 60);
  restartButton.hide();
  restartButton.mousePressed(resetGame);
  restartButton.style('font-size', '20px');
  restartButton.style('cursor', 'pointer');
  restartButton.style('background-color', '#fff');
  restartButton.style('border', '1px solid #000');
  restartButton.style('border-radius', '5px');

  // 建立開始按鈕
  startButton = createButton('開始');
  startButton.size(150, 50);
  startButton.position(width / 2 - 75, height / 2 + 100);
  startButton.mousePressed(() => {
    gameState = 1;
    startButton.hide();
  });
  startButton.style('font-size', '20px');
  startButton.style('cursor', 'pointer');
  startButton.style('background-color', '#fff');
  startButton.style('border', '1px solid #000');
  startButton.style('border-radius', '5px');
  if (gameState !== 0) startButton.hide();

  // --- Initialize NPCs ---
  const { sideChar, bottomLeftChar, topLeftChar, bottomRightChar } = npcs;

  updateFrameSize(sideChar);
  sideChar.lastChange = millis();
  sideChar.x = width - sideChar.frameW / 2 - 150;
  sideChar.y = height / 2 + 200;

  updateFrameSize(bottomLeftChar);
  bottomLeftChar.lastChange = millis();
  bottomLeftChar.x = random(width * 0.3, width * 0.7);
  bottomLeftChar.y = height / 2 + 230;

  updateFrameSize(topLeftChar);
  topLeftChar.lastChange = millis();
  topLeftChar.x = topLeftChar.frameW / 2 + 750;
  topLeftChar.y = height / 2 + 200;

  updateFrameSize(bottomRightChar);
  bottomRightChar.lastChange = millis();
  bottomRightChar.x = width / 2; // 放在中間
  bottomRightChar.y = height / 2 + 200;

  // 處理載入的 CSV 資料
  if (questionTable) {
    for (let row of questionTable.getRows()) {
      questions.push({
        question: row.getString(0), // 索引 0: 題目
        answer: row.getString(1),   // 索引 1: 答案
        correctFeedback: row.getString(2), // 索引 2: 答對回應
        wrongFeedback: row.getString(3),   // 索引 3: 答錯回應
        hint: row.getString(4),      // 索引 4: 提示
        isSolved: false // 是否已答對
      });
    }
  }
}

function updateFrameSize(character) {
  // 根據傳入的角色物件更新其影格尺寸
  const s = character.sprites ? character.sprites[character.currentKey] : character.sprite;
  if (s && s.img) { // 檢查圖片是否已載入
    // 若 sprite 指定了固定寬高就用它，否則從圖檔計算
    if (typeof s.frameW !== 'undefined' && typeof s.frameH !== 'undefined') {
      character.frameW = s.frameW;
      character.frameH = s.frameH;
    } else {
      character.frameW = s.img.width / s.frames;
      character.frameH = s.img.height;
    }
  } else {
    character.frameW = character.frameH = 0;
  }
}

function draw() {
  // 震動效果
  if (millis() < shakeEndTime) {
    translate(random(-10, 10), random(-10, 10));
  }

  // 繪製背景圖片
  image(bgImg, 0, 0, width, height);

  // 遊戲介紹頁面
  if (gameState === 0) {
    fill(0);
    textSize(40);
    textAlign(CENTER, CENTER);
    text("遊戲介紹", width / 2, height / 2 - 100);
    textSize(24);
    text("此遊戲生活常識題，4選1選擇題\n答對3題可去下一關總共有3關\n生命有4條，4條生命沒了就失敗", width / 2, height / 2);
    startButton.show();
    return;
  }

  fill(255, 0, 0); // 設定愛心為紅色
  for (let i = 0; i < lives; i++) {
    text("❤", 20 + i * 30, 50); // 繪製愛心，每個間隔 30 像素
  }

  if (lives <= 0) {
    fill(255, 0, 0);
    textSize(60);
    textAlign(CENTER, CENTER);
    text("挑戰失敗", width / 2, height / 2);
    restartButton.show();
    // 即使失敗也要顯示閃爍效果
    if (millis() < flashEndTime) {
      push();
      noStroke();
      fill(255, 0, 0, 100);
      rect(-50, -50, width + 100, height + 100);
      pop();
    }
    return;
  }

  // --- Update and Draw NPCs ---
  for (const key in npcs) {
    const npc = npcs[key];

    // 根據頁面決定顯示哪個 NPC
    let isVisible = false;
    if (npc === npcs.bottomLeftChar) isVisible = true; // 精靈5在所有頁面都顯示
    else if (gameState === 2 && npc === npcs.sideChar) isVisible = true;
    else if (gameState === 3 && npc === npcs.topLeftChar) isVisible = true;
    else if (gameState === 4 && npc === npcs.bottomRightChar) isVisible = true;

    if (!isVisible) continue;

    // 特定角色的更新邏輯
    if (npc === npcs.bottomLeftChar) {
      // 精靈5跟隨主角
      updateFollowMovement(npc);
    }

    if (npc === npcs.sideChar || npc === npcs.topLeftChar) npc.facingRight = mainChar.x > npc.x;
    updateAndDrawCharacter(npc);
  }

  // 處理碰撞與對話
  handleCollisionAndDialogue();

  // 如果回饋計時器正在運行，檢查是否該隱藏對話
  if (feedbackTimer && millis() > feedbackTimer) {
    hideDialogueAndInput();
    feedbackTimer = null; // 重置計時器
  }

  // 更新並繪製主要角色
  updateAndDrawCharacter(mainChar);

  // 檢查是否碰到右邊邊框，若是則切換到下一頁
  if (mainChar.x >= width - mainChar.frameW / 2 - 5) {
    let canProceed = true;
    // 檢查當前頁面的 NPC 是否已通關 (答對 3 題)
    if (gameState === 2 && npcs.sideChar.correctCount < 3) canProceed = false;
    if (gameState === 3 && npcs.topLeftChar.correctCount < 3) canProceed = false;
    if (gameState === 4 && npcs.bottomRightChar.correctCount < 3) canProceed = false;

    if (canProceed) {
      if (gameState < 4) { // 允許切換到第 4 頁
        gameState++;
        mainChar.x = mainChar.frameW / 2 + 20; // 傳送到左邊，讓角色從第 2 頁左側進入
        npcs.bottomLeftChar.x = mainChar.x - 50; // 精靈5也傳送到左邊
        hideDialogueAndInput();
      }
    } else {
      mainChar.x = width - mainChar.frameW / 2 - 10; // 擋住角色
      fill(255, 0, 0);
      textSize(30);
      textAlign(CENTER, CENTER);
      text("請先完成 3 題問答才能通關！", width / 2, height / 2);
    }
  }

  // 如果正在提問，讓輸入框或按鈕跟隨主要角色
  if (dialogueVisible && currentQuestion) {
    // 如果按鈕是顯示的，就更新按鈕位置 (顯示在 NPC 頭上，題目下方)
    if (optionButtons[0].elt.style.display !== 'none') {
      let target = activeNPC || mainChar;
      let startY = target.y - target.frameH / 2 - 130;
      for (let i = 0; i < 4; i++) {
        let col = i % 2;
        let row = floor(i / 2);
        optionButtons[i].position(target.x - 85 + col * 90, startY + row * 50);
      }
    } else {
      // 否則更新輸入框位置
      answerInput.position(mainChar.x - answerInput.width / 2, mainChar.y - mainChar.frameH / 2 - 40);
    }
  }

  // 閃爍效果
  if (millis() < flashEndTime) {
    push();
    noStroke();
    fill(255, 0, 0, 100);
    rect(-50, -50, width + 100, height + 100);
    pop();
  }

  // 第4頁通關畫面 (Overlay)
  if (gameState === 4 && npcs.bottomRightChar.correctCount >= 3) {
    fill(0);
    textSize(100);
    textAlign(CENTER, CENTER);
    text("恭喜通關", width / 2, height / 2);
    restartButton.show();

    // 放煙火邏輯
    if (random(1) < 0.05) {
      fireworks.push(new Firework());
    }
    push();
    colorMode(HSB); // 切換到 HSB 模式讓顏色更鮮豔
    for (let i = fireworks.length - 1; i >= 0; i--) {
      fireworks[i].update();
      fireworks[i].show();
      if (fireworks[i].done()) {
        fireworks.splice(i, 1);
      }
    }
    pop(); // 恢復原本的顏色模式
  }
}

// 抽取出更新與繪製單一角色的邏輯
function updateAndDrawCharacter(character) {
  const s = character.sprites ? character.sprites[character.currentKey] : character.sprite;
  if (!s || !s.img || !s.img.width) return; // 如果圖片還沒載入完成，就先不畫

  // 更新動畫幀
  if (millis() - character.lastChange >= FRAME_INTERVAL) {
    character.currentFrame = (character.currentFrame + 1) % s.frames;
    character.lastChange = millis();
  }

  // 更新位置 (僅對主要角色)
  if (character.velocityX !== undefined) character.x += character.velocityX;
  if (character.velocityY !== undefined) character.y += character.velocityY;

  // 邊界限制 (適用於所有有速度的角色)
  if (character.velocityX !== undefined) {
    const halfFrameW = character.frameW / 2;
    character.x = constrain(character.x, halfFrameW, width - halfFrameW);
  }
  if (character.velocityY !== undefined) {
    const halfFrameH = character.frameH / 2;
    character.y = constrain(character.y, halfFrameH, height - halfFrameH);
  }

  const sx = character.currentFrame * character.frameW;

  // 根據朝向繪製精靈 (如果角色有 facingRight 屬性)
  push();
  translate(character.x, character.y);
  if (character.facingRight === false) {
    scale(-1, 1); // 翻轉向左
  }
  image(s.img, -character.frameW / 2, -character.frameH / 2, character.frameW, character.frameH, sx, 0, character.frameW, character.frameH);
  pop();
}

function updateFollowMovement(character) {
  const stopDistance = 100; // 停止距離
  const speed = 2; // 跟隨速度

  const dx = mainChar.x - character.x;

  if (Math.abs(dx) > stopDistance) {
    if (dx > 0) {
      character.velocityX = speed;
      character.facingRight = true;
    } else {
      character.velocityX = -speed;
      character.facingRight = false;
    }
  } else {
    character.velocityX = 0;
  }
}

function handleCollisionAndDialogue() {
  // 只有在沒有對話進行時，才偵測新的碰撞
  if (!dialogueVisible && millis() - lastCollisionTime > COLLISION_COOLDOWN) {
    // 從 npcs 物件中篩選出可互動的角色
    const interactiveNpcs = Object.values(npcs).filter(npc => {
      if (!npc.isInteractive) return false;
      if (gameState === 2 && npc === npcs.sideChar) return true;
      if (gameState === 3 && npc === npcs.topLeftChar) return true;
      if (gameState === 4 && npc === npcs.bottomRightChar) return true;
      return false;
    });

    for (const npc of interactiveNpcs) {
      const d = dist(mainChar.x, mainChar.y, npc.x, npc.y);
      let collisionThreshold;

      if (npc === npcs.topLeftChar || npc === npcs.bottomRightChar) {
        // 為精靈3和4設定一個較大的觸發範圍（"周圍"）
        collisionThreshold = (mainChar.frameW / 2 + npc.frameW / 2) * 1.5;
      } else {
        // 精靈2維持較近的觸發距離
        collisionThreshold = (mainChar.frameW / 2 + npc.frameW / 2) * 0.5;
      }

      if (d < collisionThreshold) {
        triggerQuestion(npc);
        break; // 一次只觸發一個 NPC
      }
    }
  }

  // 如果對話可見，就繪製它
  if (dialogueVisible) {
    // 檢查玩家是否遠離了互動中的 NPC
    if (activeNPC && currentQuestion) {
      const d = dist(mainChar.x, mainChar.y, activeNPC.x, activeNPC.y);
      let separationThreshold;
      if (activeNPC === npcs.topLeftChar || activeNPC === npcs.bottomRightChar) {
        separationThreshold = (mainChar.frameW / 2 + activeNPC.frameW / 2) * 1.5;
      } else {
        separationThreshold = (mainChar.frameW / 2 + activeNPC.frameW / 2) * 0.5; // 適用於精靈2
      }

      if (d > separationThreshold * 1.1) { // 增加一個緩衝區避免閃爍
        hideDialogueAndInput();
        return; // 提前退出，不繪製文字
      }
    }

    fill(0);
    textSize(20);
    textAlign(CENTER, CENTER);

    // 判斷文字要顯示在哪個角色上方
    if (npcs.bottomLeftChar.currentKey === 'transform') { // 答錯提示，顯示在精靈5上方
      text(character2Dialogue, npcs.bottomLeftChar.x, npcs.bottomLeftChar.y - npcs.bottomLeftChar.frameH / 2 - 30);
    } else if (activeNPC) { // 問題或答對回饋，顯示在當前互動的 NPC 上方
      let textY = activeNPC.y - activeNPC.frameH / 2 - 30;
      // 如果是選擇題（按鈕顯示中），將文字往上移，讓出空間給按鈕
      if (optionButtons[0].elt.style.display !== 'none') {
        textY = activeNPC.y - activeNPC.frameH / 2 - 160;
      }
      text(character2Dialogue, activeNPC.x, textY);
    }
  }
}

function triggerQuestion(npc) {
  // 如果該 NPC 已經答對 3 題，顯示通關文字並不需再出題
  if (npc.correctCount >= 3) {
    if (npc === npcs.bottomRightChar) return; // 第4頁通關時不顯示對話框，直接顯示通關畫面
    activeNPC = npc;
    character2Dialogue = "恭喜通關！";
    dialogueVisible = true;
    lastCollisionTime = millis();
    hideOptionButtons();
    answerInput.hide();
    return;
  }

  if (questions.length > 0) {
    activeNPC = npc; // 設定當前互動的 NPC
    if (!currentQuestion) { // 如果沒有待解決的問題，才選新題
      const range = npc.questionRange || { start: 0, end: questions.length - 1 }; // Fallback
      
      // 找出該範圍內尚未回答正確的題目索引
      let availableIndices = [];
      for (let i = range.start; i <= range.end; i++) {
        if (i < questions.length && !questions[i].isSolved) {
          availableIndices.push(i);
        }
      }

      if (availableIndices.length > 0) {
        const randomIndex = floor(random(availableIndices.length));
        const questionIndex = availableIndices[randomIndex];
        currentQuestion = questions[questionIndex];
      } else {
        return; // 不要觸發問答
      }
    }

    // 檢查是否有選項 (A. ... B. ... C. ... D. ...)
    // 使用 Regex 解析題目與選項
    const match = currentQuestion.question.match(/^(.*?)[“"”\s]*(A\..*?)(B\..*?)(C\..*?)(D\..*)$/);
    
    if (match) {
      // 如果是選擇題
      character2Dialogue = match[1].trim(); // 題目部分
      optionButtons[0].html(match[2]);
      optionButtons[1].html(match[3]);
      optionButtons[2].html(match[4]);
      optionButtons[3].html(match[5]);
      showOptionButtons();
      answerInput.hide();
    } else {
      // 如果是填空題 (如數學)
      character2Dialogue = currentQuestion.question;
      showAnswerInput();
      hideOptionButtons();
    }

    dialogueVisible = true;
    lastCollisionTime = millis();
  }
}

function keyPressed() {
  if (keyCode === RIGHT_ARROW) {
    if (mainChar.currentKey !== 'walk') {
      mainChar.currentKey = 'walk';
      mainChar.currentFrame = 0;
      updateFrameSize(mainChar);
      mainChar.lastChange = millis();
    }
    mainChar.isWalking = true;
    mainChar.facingRight = true;
    mainChar.velocityX = WALK_SPEED; // 向右移動
  } else if (keyCode === LEFT_ARROW) {
    if (mainChar.currentKey !== 'walk') {
      mainChar.currentKey = 'walk';
      mainChar.currentFrame = 0;
      updateFrameSize(mainChar);
      mainChar.lastChange = millis();
    }
    mainChar.isWalking = true;
    mainChar.facingRight = false;
    mainChar.velocityX = -WALK_SPEED; // 向左移動
  } else if (keyCode === ENTER) {
    // 如果輸入框可見且有問題，就檢查答案
    if (dialogueVisible && currentQuestion) {
      checkAnswer();
    }
  }
}

function checkAnswer(btnValue) {
  let userAnswer = btnValue;
  // 如果不是透過按鈕傳入值 (例如按 Enter)，則讀取輸入框
  if (typeof userAnswer !== 'string') {
    if (optionButtons[0].elt.style.display !== 'none') return; // 按鈕模式下忽略 Enter
    userAnswer = answerInput.value();
  }

  if (userAnswer === currentQuestion.answer) {
    currentQuestion.isSolved = true; // 標記為已解決
    character2Dialogue = currentQuestion.correctFeedback;
    score += 10; // 答對加分

    // 增加該 NPC 的答對次數
    if (activeNPC) {
      activeNPC.correctCount++;
      if (activeNPC.correctCount >= 3) character2Dialogue = "恭喜通關！";
    }

    // 答對了，才將問題清除，以便下次換新題
    currentQuestion = null;
    feedbackTimer = millis() + 2000; // 答對回饋顯示 2 秒
  } else {
    lives--;
    shakeEndTime = millis() + 500; // 震動 0.5 秒
    flashEndTime = millis() + 200; // 閃爍 0.2 秒
    if (lives <= 0) {
      hideDialogueAndInput();
      return;
    }
    // 答錯時，顯示提示並觸發精靈5的變身
    character2Dialogue = currentQuestion.hint;
    npcs.bottomLeftChar.currentKey = 'transform';
    npcs.bottomLeftChar.currentFrame = 0;
    updateFrameSize(npcs.bottomLeftChar);
    npcs.bottomLeftChar.lastChange = millis();
    feedbackTimer = millis() + 4000; // 提示顯示 4 秒
  }
  answerInput.hide(); // 隱藏輸入框
  hideOptionButtons(); // 隱藏按鈕
  if (gameState === 4 && npcs.bottomRightChar.correctCount >= 3) {
    dialogueVisible = false; // 第4頁通關時隱藏對話框
  } else {
    dialogueVisible = true; // 確保回饋/提示文字是可見的
  }
}

function showAnswerInput() {
  // 將輸入框定位在主要角色頭上
  answerInput.position(mainChar.x - answerInput.width / 2, mainChar.y - mainChar.frameH / 2 - 40);
  answerInput.show();
  answerInput.value(''); // 清空上次的輸入
  answerInput.elt.focus(); // 自動聚焦，讓玩家可以直接輸入
  hideOptionButtons(); // 確保按鈕是隱藏的
}

function showOptionButtons() {
  for (let btn of optionButtons) btn.show();
}

function hideOptionButtons() {
  for (let btn of optionButtons) btn.hide();
}

function hideDialogueAndInput() {
  dialogueVisible = false;
  answerInput.hide();
  hideOptionButtons();
  activeNPC = null; // 清除互動中的 NPC
  // 如果答錯了，currentQuestion 不會是 null，對話框隱藏後，下次碰撞會問同一個問題
  // 如果答對了，currentQuestion 已經被設為 null，下次碰撞會問新問題
  feedbackTimer = null; // 清除計時器

  // 如果精靈5處於變身狀態，將其恢復
  if (npcs.bottomLeftChar.currentKey === 'transform') {
    npcs.bottomLeftChar.currentKey = 'default';
    npcs.bottomLeftChar.currentFrame = 0;
    updateFrameSize(npcs.bottomLeftChar);
    npcs.bottomLeftChar.lastChange = millis();
  }
}

function keyReleased() {
  // 放開任何方向鍵時恢復站立精靈並停止相對方向的移動
  if (keyCode === RIGHT_ARROW || keyCode === LEFT_ARROW) {
    mainChar.velocityX = 0;
  }

  // 若沒有任何方向鍵按著，回到站立精靈
  if (!keyIsDown(LEFT_ARROW) && !keyIsDown(RIGHT_ARROW)) {
    if (mainChar.currentKey !== 'stance') {
      mainChar.currentKey = 'stance';
      mainChar.currentFrame = 0;
      updateFrameSize(mainChar);
      mainChar.lastChange = millis();
    }
    mainChar.isWalking = false;
  }
}

// 當滑鼠按下時切換到 slash（僅處理左鍵）
function mousePressed() {
  if (mouseButton === LEFT) {
    mainChar.prevKey = mainChar.currentKey;
    mainChar.currentKey = 'slash';
    mainChar.currentFrame = 0;
    updateFrameSize(mainChar);
    mainChar.lastChange = millis();
  }
}

// 放開滑鼠左鍵還原到先前的精靈（若無暫存則回到 stance）
function mouseReleased() {
  if (mouseButton === LEFT) {
    const restore = mainChar.prevKey || 'stance';
    // 若玩家同時按方向鍵則優先回到 walk
    if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW)) {
      mainChar.currentKey = 'walk';
    } else {
      mainChar.currentKey = restore;
    }
    mainChar.currentFrame = 0;
    updateFrameSize(mainChar);
    mainChar.lastChange = millis();
    mainChar.prevKey = null;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function resetGame() {
  lives = 4;
  score = 0;
  gameState = 1;

  // 重置主角位置
  mainChar.x = width / 2;
  mainChar.y = height / 2 + 220;
  mainChar.velocityX = 0;
  mainChar.facingRight = true;

  // 重置 NPC 狀態
  npcs.sideChar.correctCount = 0;
  npcs.topLeftChar.correctCount = 0;
  npcs.bottomRightChar.correctCount = 0;

  // 重置精靈5
  npcs.bottomLeftChar.x = random(width * 0.3, width * 0.7);
  npcs.bottomLeftChar.currentKey = 'default';

  fireworks = []; // 清空煙火
  // 重置題目狀態
  for (let q of questions) {
    q.isSolved = false;
  }

  hideDialogueAndInput();
  restartButton.hide();
}

// --- 煙火相關類別 ---
class Firework {
  constructor() {
    this.hu = random(255);
    this.firework = new Particle(random(width), height, true, this.hu);
    this.exploded = false;
    this.particles = [];
  }

  done() {
    return this.exploded && this.particles.length === 0;
  }

  update() {
    if (!this.exploded) {
      this.firework.applyForce(createVector(0, 0.2));
      this.firework.update();
      if (this.firework.vel.y >= 0) {
        this.exploded = true;
        this.explode();
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].applyForce(createVector(0, 0.2));
      this.particles[i].update();
      if (this.particles[i].done()) {
        this.particles.splice(i, 1);
      }
    }
  }

  explode() {
    for (let i = 0; i < 200; i++) {
      const p = new Particle(this.firework.pos.x, this.firework.pos.y, false, this.hu);
      this.particles.push(p);
    }
  }

  show() {
    if (!this.exploded) {
      this.firework.show();
    }
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].show();
    }
  }
}

class Particle {
  constructor(x, y, firework, hu) {
    this.pos = createVector(x, y);
    this.firework = firework;
    this.lifespan = 255;
    this.hu = hu;
    this.acc = createVector(0, 0);
    if (this.firework) {
      this.vel = createVector(0, random(-18, -12));
    } else {
      this.vel = p5.Vector.random2D();
      this.vel.mult(random(5, 25));
    }
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    if (!this.firework) {
      this.vel.mult(0.9);
      this.lifespan -= 4;
    }
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  done() {
    return this.lifespan < 0;
  }

  show() {
    if (!this.firework) {
      strokeWeight(6);
      stroke(this.hu, 255, 255, this.lifespan);
    } else {
      strokeWeight(8);
      stroke(this.hu, 255, 255);
    }
    point(this.pos.x, this.pos.y);
  }
}

