import { useRef } from "react";

// 인원 관리창
export default function UserControlPanel({ open, users, onKickUser }) {
    const panelRef = useRef(null); // 인원 관리창 Ref
    // const DUMMY_COUNT = 50; // 더미 데이터 수

    // 더미 유저 생성기
    // const dummyUsers = (() => {
    //     const arr = Array.isArray(users) ? [...users] : [];

    //     for (let i = 0; i< DUMMY_COUNT; i++){
    //         arr.push({
    //             id: `dummy-${i}`,
    //             nickname: `테스트 유저 ${i + 1}`,
    //             username: `user_${i + 1}`
    //         });
    //     }

    //     return arr;
    // })();

    let userList = users;

    return (
        <div 
            ref={panelRef}
            style={{
                position: "absolute",
                display: "grid",
                left: 120,
                top: 50,
                width: 800,
                height: 600,
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: 12,
                zIndex: 1000,
                overflow: 'hidden',

                /* --- 패널 자체는 block으로 두고, 내부 콘텐츠를 Grid로 --- */
                gridTemplateRows: "auto 1fr",
                rowGap: 12
            }}
        >
            {/* 상단 바 (옵션) */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    padding: "8px 20px 8px 8px"
                }}
            >
                <strong style={{ fontSize: 16 }}>인원 관리</strong>
                <span style={{ fontSize: 15, color: "#4b4b4bff", fontWeight: "bold" }}>{userList.length}명</span>
            </div>

            {/* 사용자 목록 Grid */}
            <div
                style={{
                    display: "grid",
                    /* 한 줄에 들어갈 만큼 자동 배치 + 줄바꿈 */
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 10,
                    alignContent: "start",

                    /* 스크롤 포인트 */
                    overflowY: "auto",
                    minHeight: 0,
                    maxHeight: "100%",
                    scrollbarGutter: "stable",
                    overscrollBehavior: "contain",
                    paddingRight: 2
                }}
            >
                {userList.map(user => {
                    const name = user.nickname || user.username || 'Unknown';
                    
                    // 유저마다 div 요소로 생성
                    return (
                        <div
                            key={user.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                columnGap: 8,
                                padding: "10px 12px",
                                border: "1px solid #eee",
                                borderRadius: 10,
                                background: "#f8f8f8ff"
                            }}
                        >
                            <span
                                title={name}
                                style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize: 14
                                }}
                            >
                                {name}
                            </span>
                            <button
                                type="button"
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    border: "1px solid #ddd",
                                    background: "#fc8989ff",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    color: "#ffffffff"
                                }}
                                onClick={() => {
                                    onKickUser(user.id);
                                    console.log("강퇴함: ", user);
                                }}
                            >
                                강퇴
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}