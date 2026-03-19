const BOARD_SIZE = 3;
const PLAYERS = {
  blue: { label: "사자" },
  orange: { label: "호랑이" },
};
const SIZE_ORDER = {
  small: 1,
  medium: 2,
  large: 3,
};
const SIZE_LABELS = {
  small: "소",
  medium: "중",
  large: "대",
};
const TOKEN_IMAGE_VERSION = "2026-03-19-1";
const WINNING_LINES = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

const boardEl = document.getElementById("board");
const reserveBlueEl = document.getElementById("reserve-blue");
const reserveOrangeEl = document.getElementById("reserve-orange");
const turnIndicatorEl = document.getElementById("turn-indicator");
const selectionIndicatorEl = document.getElementById("selection-indicator");
const messageEl = document.getElementById("message");
const resetBtn = document.getElementById("reset-btn");

let state = createInitialState();

function createPiece(player, size, number) {
  return {
    id: `${player}-${size}-${number}`,
    player,
    size,
  };
}

function createReserve(player) {
  return [
    createPiece(player, "large", 1),
    createPiece(player, "large", 2),
    createPiece(player, "medium", 1),
    createPiece(player, "medium", 2),
    createPiece(player, "small", 1),
    createPiece(player, "small", 2),
  ];
}

function createInitialState() {
  return {
    board: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => ({ stack: [] }))
    ),
    players: {
      blue: { reserve: createReserve("blue") },
      orange: { reserve: createReserve("orange") },
    },
    currentPlayer: "blue",
    selectedSource: null,
    availableMoves: [],
    winner: null,
    winningLine: [],
    message: "사자 차례입니다. 남은 말 또는 보드 위의 내 말을 클릭하세요.",
  };
}

function render() {
  renderBoard();
  renderReserve("blue", reserveBlueEl);
  renderReserve("orange", reserveOrangeEl);
  updateStatus();
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cellEl = document.createElement("button");
      cellEl.type = "button";
      cellEl.className = "cell";

      if (isHighlightedMove(row, col)) {
        cellEl.classList.add("highlight-move");
      }

      if (isWinningCell(row, col)) {
        cellEl.classList.add("winning-cell");
      }

      const topPiece = getTopPieceAt(row, col);
      if (topPiece) {
        const pieceEl = createPieceElement(topPiece);
        if (isSelectedBoardPiece(row, col, topPiece.id)) {
          pieceEl.classList.add("selected");
        }
        if (isWinningCell(row, col)) {
          pieceEl.classList.add("winning-piece");
        }
        cellEl.appendChild(pieceEl);
      }

      if (!state.winner) {
        const selectableBoardPiece =
          topPiece &&
          topPiece.player === state.currentPlayer &&
          getAvailableMovesForPiece(topPiece, { row, col }).length > 0;

        if (selectableBoardPiece || isHighlightedMove(row, col)) {
          cellEl.classList.add("selectable");
        }

        cellEl.addEventListener("click", () => onBoardCellClick(row, col));
        cellEl.addEventListener("pointerup", () => onBoardCellClick(row, col));
      } else {
        cellEl.disabled = true;
      }

      boardEl.appendChild(cellEl);
    }
  }
}

function renderReserve(player, container) {
  if (!container) return;

  container.innerHTML = "";
  const reserve = state.players[player].reserve;

  if (reserve.length === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "reserve-empty";
    emptyEl.textContent = "남은 말 없음";
    container.appendChild(emptyEl);
    return;
  }

  reserve.forEach((piece) => {
    const pieceButton = document.createElement("button");
    pieceButton.type = "button";
    pieceButton.className = "reserve-piece";
    pieceButton.appendChild(createPieceElement(piece));

    const label = document.createElement("span");
    label.className = "piece-label";
    label.textContent = SIZE_LABELS[piece.size];
    pieceButton.appendChild(label);

    const allowed = getAvailableMovesForPiece(piece).length > 0;
    const isCurrentPlayer = player === state.currentPlayer;
    const isSelected =
      state.selectedSource &&
      state.selectedSource.type === "reserve" &&
      state.selectedSource.pieceId === piece.id;

    if (isSelected) {
      pieceButton.classList.add("selected");
    }

    if (!state.winner && isCurrentPlayer && allowed) {
      pieceButton.classList.add("selectable");
      const handleSelect = () => onReservePieceClick(player, piece.id);
      pieceButton.addEventListener("click", handleSelect);
      pieceButton.addEventListener("pointerdown", handleSelect);
    } else {
      pieceButton.disabled = true;
    }

    container.appendChild(pieceButton);
  });
}

function createPieceElement(piece) {
  const pieceEl = document.createElement("div");
  pieceEl.className = `piece ${piece.player} ${piece.size}`;

  const img = document.createElement("img");
  img.className = "token-image";
  img.alt = PLAYERS[piece.player].label;
  img.src =
    piece.player === "blue"
      ? `사자.jpg?v=${TOKEN_IMAGE_VERSION}`
      : `호랑이.jpg?v=${TOKEN_IMAGE_VERSION}`;
  img.draggable = false;
  pieceEl.appendChild(img);

  return pieceEl;
}

function onReservePieceClick(player, pieceId) {
  if (state.winner || player !== state.currentPlayer) return;

  if (state.selectedSource && state.selectedSource.type === "board") {
    setMessage("보드에서 집은 말은 반드시 다른 칸으로 움직여야 합니다.");
    render();
    return;
  }

  const piece = findReservePiece(player, pieceId);
  if (!piece) return;

  if (
    state.selectedSource &&
    state.selectedSource.type === "reserve" &&
    state.selectedSource.pieceId === pieceId
  ) {
    clearSelection();
    setMessage(`${PLAYERS[player].label} 차례입니다. 둘 말을 다시 골라 보세요.`);
    render();
    return;
  }

  const moves = getAvailableMovesForPiece(piece);
  if (moves.length === 0) {
    setMessage("이 말은 지금 놓을 수 있는 자리가 없습니다.");
    render();
    return;
  }

  state.selectedSource = { type: "reserve", player, pieceId };
  state.availableMoves = moves;
  setMessage(`${getPieceLabel(piece)}을(를) 놓을 칸을 클릭하세요.`);
  render();
}

function onBoardCellClick(row, col) {
  if (state.winner) return;

  if (isHighlightedMove(row, col)) {
    commitMove(row, col);
    return;
  }

  const topPiece = getTopPieceAt(row, col);
  if (!topPiece) {
    if (state.selectedSource && state.selectedSource.type === "board") {
      setMessage("선택한 보드 말은 반짝이는 칸으로만 옮길 수 있습니다.");
      render();
    }
    return;
  }

  if (topPiece.player !== state.currentPlayer) {
    if (state.selectedSource && state.selectedSource.type === "board") {
      setMessage("다른 말을 고를 수 없습니다. 먼저 선택한 말을 움직여야 합니다.");
      render();
    }
    return;
  }

  const moves = getAvailableMovesForPiece(topPiece, { row, col });
  if (moves.length === 0) {
    setMessage("이 말은 지금 움직일 수 있는 칸이 없습니다.");
    render();
    return;
  }

  if (state.selectedSource && state.selectedSource.type === "board") {
    setMessage("보드에서 집은 말은 반드시 다른 칸으로 움직여야 합니다.");
    render();
    return;
  }

  state.selectedSource = {
    type: "board",
    row,
    col,
    pieceId: topPiece.id,
  };
  state.availableMoves = moves;
  setMessage(`${getPieceLabel(topPiece)}을(를) 옮길 칸을 클릭하세요.`);
  render();
}

function commitMove(targetRow, targetCol) {
  const piece = getSelectedPiece();
  if (!piece || !isHighlightedMove(targetRow, targetCol)) return;

  if (state.selectedSource.type === "reserve") {
    const reserve = state.players[state.currentPlayer].reserve;
    const pieceIndex = reserve.findIndex((entry) => entry.id === state.selectedSource.pieceId);
    if (pieceIndex === -1) return;
    reserve.splice(pieceIndex, 1);
  } else {
    const sourceCell = state.board[state.selectedSource.row][state.selectedSource.col];
    const liftedPiece = sourceCell.stack.pop();
    if (!liftedPiece || liftedPiece.id !== state.selectedSource.pieceId) return;
  }

  state.board[targetRow][targetCol].stack.push(piece);
  clearSelection();

  const winnerInfo = getWinnerAfterMove(state.currentPlayer);
  if (winnerInfo) {
    state.winner = winnerInfo.player;
    state.winningLine = winnerInfo.line;
    if (winnerInfo.player === state.currentPlayer) {
      setMessage(`${PLAYERS[winnerInfo.player].label} 승리! 3개를 한 줄로 만들었습니다.`);
    } else {
      setMessage(
        `${PLAYERS[winnerInfo.player].label} 승리! 숨겨져 있던 줄이 다시 드러났습니다.`
      );
    }
  } else {
    state.currentPlayer = getOpponent(state.currentPlayer);
    setMessage(`${PLAYERS[state.currentPlayer].label} 차례입니다. 말을 하나 선택하세요.`);
  }

  render();
}

function getAvailableMovesForPiece(piece, source = null) {
  const moves = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (source && source.row === row && source.col === col) {
        continue;
      }

      const topPiece = getTopPieceAt(row, col);
      if (canCover(piece, topPiece)) {
        moves.push({ row, col });
      }
    }
  }

  return moves;
}

function canCover(movingPiece, targetPiece) {
  if (!targetPiece) return true;
  return SIZE_ORDER[movingPiece.size] > SIZE_ORDER[targetPiece.size];
}

function getTopPieceAt(row, col) {
  const stack = state.board[row][col].stack;
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function findReservePiece(player, pieceId) {
  return state.players[player].reserve.find((piece) => piece.id === pieceId) || null;
}

function getSelectedPiece() {
  if (!state.selectedSource) return null;

  if (state.selectedSource.type === "reserve") {
    return findReservePiece(state.selectedSource.player, state.selectedSource.pieceId);
  }

  const topPiece = getTopPieceAt(state.selectedSource.row, state.selectedSource.col);
  if (!topPiece || topPiece.id !== state.selectedSource.pieceId) {
    return null;
  }

  return topPiece;
}

function getWinnerAfterMove(lastMover) {
  const opponent = getOpponent(lastMover);
  const opponentLine = findWinningLine(opponent);
  if (opponentLine) {
    return { player: opponent, line: opponentLine };
  }

  const moverLine = findWinningLine(lastMover);
  if (moverLine) {
    return { player: lastMover, line: moverLine };
  }

  return null;
}

function findWinningLine(player) {
  for (const line of WINNING_LINES) {
    const ownsLine = line.every(([row, col]) => {
      const topPiece = getTopPieceAt(row, col);
      return topPiece && topPiece.player === player;
    });

    if (ownsLine) {
      return line.map(([row, col]) => ({ row, col }));
    }
  }

  return null;
}

function isHighlightedMove(row, col) {
  return state.availableMoves.some((move) => move.row === row && move.col === col);
}

function isWinningCell(row, col) {
  return state.winningLine.some((cell) => cell.row === row && cell.col === col);
}

function isSelectedBoardPiece(row, col, pieceId) {
  return (
    state.selectedSource &&
    state.selectedSource.type === "board" &&
    state.selectedSource.row === row &&
    state.selectedSource.col === col &&
    state.selectedSource.pieceId === pieceId
  );
}

function getOpponent(player) {
  return player === "blue" ? "orange" : "blue";
}

function getPieceLabel(piece) {
  return `${PLAYERS[piece.player].label} ${SIZE_LABELS[piece.size]} 말`;
}

function clearSelection() {
  state.selectedSource = null;
  state.availableMoves = [];
}

function setMessage(text) {
  state.message = text;
  if (messageEl) {
    messageEl.textContent = text;
  }
}

function updateStatus() {
  if (turnIndicatorEl) {
    const prefix = state.winner ? "승리" : "현재 턴";
    const activePlayer = state.winner || state.currentPlayer;
    turnIndicatorEl.textContent = `${prefix}: ${PLAYERS[activePlayer].label}`;
  }

  if (selectionIndicatorEl) {
    const piece = getSelectedPiece();
    selectionIndicatorEl.textContent = piece ? `선택된 말: ${getPieceLabel(piece)}` : "선택된 말: 없음";
  }

  if (messageEl) {
    messageEl.textContent = state.message;
  }
}

function resetGame() {
  state = createInitialState();
  render();
}

resetBtn?.addEventListener("click", resetGame);

render();

