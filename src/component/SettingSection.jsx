export default function SettingSection({
    channelName,
    setChannelName,
    isJoined
}) {
    return(
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3>설정</h3>
            <div style={{ marginBottom: '10px' }}>
            <label>
                채널명: 
                <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                disabled={isJoined}
                style={{ marginLeft: '10px', padding: '5px' }}
                />
            </label>
            </div>
        </div>
    );
}