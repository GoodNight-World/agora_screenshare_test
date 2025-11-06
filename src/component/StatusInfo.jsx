export default function StatusInfo({
    isJoined,
    channelName,
    uid,
    isSharing,
    isAudioEnabled,
    localAudioTrack,
    localScreenTrack
}) {
    return(
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div><strong>상태:</strong> {isJoined ? `채널 "${channelName}"에 참여중` : '채널에 참여하지 않음'}</div>
            <div><strong>화면 공유:</strong> {isSharing ? '✅ 진행중' : '❌ 중지됨'}</div>
            <div><strong>마이크:</strong> {isAudioEnabled ? (localAudioTrack?.enabled ? '🎤 활성' : '🔇 음소거') : '❌ 비활성'}</div>
            {/* <div>카메라: {isCameraEnabled ? '📹 활성' : '❌ 비활성'}</div> */}
            {localScreenTrack && (
                <div>화면공유 트랙: {localScreenTrack.isPlaying ? '▶️ 재생중' : '⏸️ 정지'}</div>
            )}
            {localScreenTrack && (
                <div>트랙 상태: {localScreenTrack.enabled ? '활성화' : '비활성화'}</div>
            )}
            </div>
        </div>
    )
}