const FRAME_INTERVAL = 100; // ms 每幀間隔
const CENTRAL_MOVEMENT_MARGIN = 250; // 精靈5在螢幕中心附近移動的邊距

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
    questionRange: { start: 1, end: 4 } // Qs 2-5
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
    questionRange: { start: 5, end: 9 } // Qs 6-10
  },
  // 精靈4
  bottomRightChar: {
    sprite: {}, frameW: 0, frameH: 0, currentFrame: 0, lastChange: 0, x: 0, y: 0,
    facingRight: false,
    isInteractive: true,
    questionRange: { start: 10, end: 14 } // Qs 11-15
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
const WALK_SPEED = 3; // 移動速度（像素/幀）

let answerInput; // 文字輸入框

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
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();

  // 初始化主要角色
  updateFrameSize(mainChar);
  mainChar.lastChange = millis();
  mainChar.x = width / 2; // 初始位置：螢幕中央
  mainChar.y = height / 2;

  // 建立輸入框並隱藏
  answerInput = createInput();
  answerInput.size(150);
  answerInput.hide();
  answerInput.elt.style.textAlign = 'center'; // 讓輸入文字置中

  // --- Initialize NPCs ---
  const { sideChar, bottomLeftChar, topLeftChar, bottomRightChar } = npcs;

  updateFrameSize(sideChar);
  sideChar.lastChange = millis();
  sideChar.x = width - sideChar.frameW / 2 - 150;
  sideChar.y = sideChar.frameH / 2 + 150;

  updateFrameSize(bottomLeftChar);
  bottomLeftChar.lastChange = millis();
  // 將初始位置設定在中央移動區域內
  const centralMinX = CENTRAL_MOVEMENT_MARGIN;
  const centralMaxX = width - CENTRAL_MOVEMENT_MARGIN;
  const centralMinY = CENTRAL_MOVEMENT_MARGIN;
  const centralMaxY = height - CENTRAL_MOVEMENT_MARGIN;
  bottomLeftChar.x = random(centralMinX + bottomLeftChar.frameW / 2, centralMaxX - bottomLeftChar.frameW / 2);
  bottomLeftChar.y = random(centralMinY + bottomLeftChar.frameH / 2, centralMaxY - bottomLeftChar.frameH / 2);
  bottomLeftChar.velocityX = random(-1, 1);
  bottomLeftChar.velocityY = random(-1, 1);

  updateFrameSize(topLeftChar);
  topLeftChar.lastChange = millis();
  topLeftChar.x = topLeftChar.frameW / 2 + 300;
  topLeftChar.y = topLeftChar.frameH / 2 + 300;

  updateFrameSize(bottomRightChar);
  bottomRightChar.lastChange = millis();
  bottomRightChar.x = width - bottomRightChar.frameW / 2 - 400; // 放在右下角，增加邊距
  bottomRightChar.y = height - bottomRightChar.frameH / 2 - 200;

  // 處理載入的 CSV 資料
  if (questionTable) {
    for (let row of questionTable.getRows()) {
      questions.push({
        question: row.getString('題目'),
        answer: row.getString('答案'),
        correctFeedback: row.getString('答對回饋'),
        wrongFeedback: row.getString('答錯回饋'),
        hint: row.getString('提示')
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
  background('#e6ccb2');

  // --- Update and Draw NPCs ---
  for (const key in npcs) {
    const npc = npcs[key];
    // 特定角色的更新邏輯
    if (npc === npcs.bottomLeftChar) updateRandomMovement(npc);
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

  // 如果正在提問，讓輸入框跟隨主要角色
  if (dialogueVisible && currentQuestion) {
    answerInput.position(mainChar.x - answerInput.width / 2, mainChar.y - mainChar.frameH / 2 - 40);
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

  // 邊界限制 (僅對主要角色)
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

function updateRandomMovement(character) {
  // 每隔一段時間（例如 2-4 秒）改變一次方向
  if (millis() - character.lastMoveChange > random(2000, 4000)) {
    character.velocityX = random(-1, 1); // 新的隨機 X 速度
    character.velocityY = random(-1, 1); // 新的隨機 Y 速度
    character.lastMoveChange = millis();
  }

  // 根據 X 方向速度決定朝向 (避免速度過小導致頻繁翻轉)
  if (character.velocityX > 0.1) {
    character.facingRight = true;
  } else if (character.velocityX < -0.1) {
    character.facingRight = false;
  }

  // 邊界反彈 (針對中央區域)
  const halfW = character.frameW / 2;
  const halfH = character.frameH / 2;

  const centralMinX = CENTRAL_MOVEMENT_MARGIN;
  const centralMaxX = width - CENTRAL_MOVEMENT_MARGIN;
  const centralMinY = CENTRAL_MOVEMENT_MARGIN;
  const centralMaxY = height - CENTRAL_MOVEMENT_MARGIN;

  if (character.x - halfW < centralMinX || character.x + halfW > centralMaxX) {
    character.velocityX *= -1; // 反彈
  }
  if (character.y - halfH < centralMinY || character.y + halfH > centralMaxY) {
    character.velocityY *= -1; // 反彈
  }
}

function handleCollisionAndDialogue() {
  // 只有在沒有對話進行時，才偵測新的碰撞
  if (!dialogueVisible && millis() - lastCollisionTime > COLLISION_COOLDOWN) {
    // 從 npcs 物件中篩選出可互動的角色
    const interactiveNpcs = Object.values(npcs).filter(npc => npc.isInteractive);

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
      text(character2Dialogue, activeNPC.x, activeNPC.y - activeNPC.frameH / 2 - 30);
    }
  }
}

function triggerQuestion(npc) {
  if (questions.length > 0) {
    activeNPC = npc; // 設定當前互動的 NPC
    if (!currentQuestion) { // 如果沒有待解決的問題，才選新題
      const range = npc.questionRange || { start: 0, end: questions.length - 1 }; // Fallback
      const questionIndex = floor(random(range.start, range.end + 1));

      // 增加保護，確保索引在題庫範圍內
      if (questionIndex < questions.length) {
        currentQuestion = questions[questionIndex];
      } else {
        console.error(`Question index ${questionIndex} is out of bounds! Check CSV file and question ranges.`);
        return; // 不要觸發問答
      }
    }
    character2Dialogue = currentQuestion.question;
    dialogueVisible = true;
    lastCollisionTime = millis();
    showAnswerInput();
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
  } else if (keyCode === UP_ARROW) {
    if (mainChar.currentKey !== 'walk') {
      mainChar.currentKey = 'walk';
      mainChar.currentFrame = 0;
      updateFrameSize(mainChar);
      mainChar.lastChange = millis();
    }
    mainChar.isWalking = true;
    mainChar.velocityY = -WALK_SPEED; // 向上移動
  } else if (keyCode === DOWN_ARROW) {
    if (mainChar.currentKey !== 'walk') {
      mainChar.currentKey = 'walk';
      mainChar.currentFrame = 0;
      updateFrameSize(mainChar);
      mainChar.lastChange = millis();
    }
    mainChar.isWalking = true;
    mainChar.velocityY = WALK_SPEED; // 向下移動
  } else if (keyCode === ENTER) {
    // 如果輸入框可見且有問題，就檢查答案
    if (dialogueVisible && currentQuestion) {
      checkAnswer();
    }
  }
}

function checkAnswer() {
  const userAnswer = answerInput.value();
  if (userAnswer === currentQuestion.answer) {
    character2Dialogue = currentQuestion.correctFeedback;
    // 答對了，才將問題清除，以便下次換新題
    currentQuestion = null;
    feedbackTimer = millis() + 2000; // 答對回饋顯示 2 秒
  } else {
    // 答錯時，顯示提示並觸發精靈5的變身
    character2Dialogue = currentQuestion.hint;
    npcs.bottomLeftChar.currentKey = 'transform';
    npcs.bottomLeftChar.currentFrame = 0;
    updateFrameSize(npcs.bottomLeftChar);
    npcs.bottomLeftChar.lastChange = millis();
    feedbackTimer = millis() + 4000; // 提示顯示 4 秒
  }
  answerInput.hide(); // 隱藏輸入框
  dialogueVisible = true; // 確保回饋/提示文字是可見的
}

function showAnswerInput() {
  // 將輸入框定位在主要角色頭上
  answerInput.position(mainChar.x - answerInput.width / 2, mainChar.y - mainChar.frameH / 2 - 40);
  answerInput.show();
  answerInput.value(''); // 清空上次的輸入
  answerInput.elt.focus(); // 自動聚焦，讓玩家可以直接輸入
}

function hideDialogueAndInput() {
  dialogueVisible = false;
  answerInput.hide();
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
  if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
    mainChar.velocityY = 0;
  }

  // 若沒有任何方向鍵按著，回到站立精靈
  if (!keyIsDown(LEFT_ARROW) && !keyIsDown(RIGHT_ARROW) && !keyIsDown(UP_ARROW) && !keyIsDown(DOWN_ARROW)) {
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
    if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW) || keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) {
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
