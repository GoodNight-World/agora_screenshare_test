export default function UserGuide() {
    return (
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#d1ecf1', borderRadius: '8px' }}>
            <h3>사용 방법:</h3>
            <ol>
                <li><strong>채널 참여:</strong> "채널 참여" 버튼으로 채널에 입장하세요</li>
                <li><strong>기능 활성화:</strong> 필요한 기능들(화면공유, 마이크)를 개별적으로 켜고 끄세요</li>
                <li><strong>테스트:</strong> 다른 브라우저에서 같은 채널명으로 접속하여 테스트하세요</li>
            </ol>
            
            <h4>주요 특징:</h4>
            <ul>
                <li>🖥️ <strong>화면 공유</strong>: 전체 화면이나 특정 애플리케이션 공유 가능</li>
                <li>🎤 <strong>음성 채팅</strong>: 마이크 켜기/끄기, 음소거 기능</li>
                {/* <li>📹 <strong>비디오 채팅</strong>: 웹캠을 통한 영상 통화</li> */}
                <li>👥 <strong>다중 사용자</strong>: 여러 명이 동시에 참여 가능</li>
                <li>🔄 <strong>실시간 동기화</strong>: 모든 기능이 실시간으로 동기화됨</li>
            </ul>

            {/* <p style={{ color: '#856404', marginTop: '10px' }}>
            <strong>참고:</strong> 모든 기능(화면공유, 음성, 영상)을 같은 채널에서 동시에 사용할 수 있습니다!
            </p> */}
        </div>
    );
}