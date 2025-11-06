import ChatHeader from "./ChatHeader";
import { useRef, useEffect } from "react";

export default function ChatPanel({
  roomId, userCount, isChatLocked,
  messages, onSend, onDelete, onLockToggle,
  onEnterPress,
}) {
  const chatRef = useRef(null); // 채팅창 DOM 참조

  // messages가 업데이트될 때마다 스크롤 아래로 이동
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: 'smooth', // 부드럽게 스크롤
      });
    }
  }, [messages]);

  return (
    <div style={{ padding: 10, border: '1px solid #000', borderRadius: 8 }}>
      {/* 헤더 */}
      {/* <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div>방: {roomId} / 인원: {userCount ?? '-'}</div>
        <label>
          <input
            type="checkbox"
            checked={isChatLocked}
            onChange={(e) => onLockToggle(e.target.checked)}
          /> 잠금
        </label>
      </div> */}
      <ChatHeader
        roomId={roomId}
        userCount={userCount}
        ChatLocked={isChatLocked}
        onLockToggle={onLockToggle}
      />

      {/* 메시지 */}
      <div id="chat" ref={chatRef}>
        {
        messages.map((m) => (
          <div key={m.id} style={{ marginBottom:8, padding:8, background:'#fff', border:'1px solid #000', borderRadius:4, display:'flex', justifyContent:'space-between' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:'bold', fontSize:14, marginBottom:2 }}>
                {m.nickname}
                <span style={{ fontSize:12, color:'#999', marginLeft:8 }}>{m.timestamp}</span>
              </div>
              <div style={{ fontSize:14 }}>{m.message}</div>
            </div>
            <button onClick={() => onDelete(m.id)} style={{ marginLeft:8, padding:'4px 8px', fontSize:12, background:'#dc3545', color:'#fff', border:'none', borderRadius:3, cursor:'pointer' }}>
              삭제
            </button>
          </div>
        ))
        }
      </div>

      {/* 입력창 */}
      <input
        id="message"
        type="text"
        placeholder="채팅 입력 후 Enter"
        onKeyUp={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            onSend(e.currentTarget.value);
            e.currentTarget.value = '';
          }
          onEnterPress?.(e);
          
        }}
        style={{ width:'100%', padding:8, boxSizing:'border-box', border:'1px solid' }}
      />
    </div>
  );
}