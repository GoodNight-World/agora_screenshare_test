import React, { useState, useRef, useEffect } from "react";

export default function ChatHeader({ roomId, userCount, isChatLocked, onLockToggle }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  // 바깥 클릭 & ESC 닫기
  useEffect(() => {
    function onDown(e) {
      if (!open) return;
      const targets = [menuRef.current, btnRef.current];
      const clickedInside = targets.some(el => el && el.contains(e.target));
      if (!clickedInside) setOpen(false);
    }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = (action) => {
    // 여기에 실제 동작을 연결하세요
    if (action === "host-only-lock") {
      onLockToggle?.(true); // 예: 호스트 외 채팅 잠금
    } else if (action === "all-chat") {
      onLockToggle?.(false); // 예: 전체 채팅 허용
    }
    setOpen(false);
  };

  return (
    <span
      style={{
        position: "relative",               // 팝업 기준점
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%"
      }}
    >
      <h3 style={{ marginTop: 10, marginLeft: 10 }}>
        채팅창 ({roomId}) - 사용자 {userCount}명 {isChatLocked ? "🔒" : "🔓"}
      </h3>

      {/* 점 3개 버튼 */}
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          marginTop: 10,
          fontSize: 28,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          marginLeft: "auto",
          padding: "2px 8px",
          lineHeight: 1
        }}
      >
        ···
      </button>

      {/* 팝업 메뉴 */}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "absolute",
            right: 8,          // 버튼 오른쪽 정렬
            bottom: 38,        // 버튼 "위에" 뜨도록 (필요시 조절)
            minWidth: 180,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 6,
            zIndex: 1000
          }}
        >
          <MenuItem onClick={() => handleSelect("host-only-lock")}>
            호스트 외 채팅 잠금
          </MenuItem>
          <MenuItem onClick={() => handleSelect("all-chat")}>
            공개 채팅
          </MenuItem>
        </div>
      )}
    </span>
  );
}

function MenuItem({ children, onClick }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: "pointer"
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
