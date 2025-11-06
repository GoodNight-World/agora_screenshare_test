export default function SettingSection({
    channelName,
    setChannelName,
    isJoined
}) {
    return(
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <div style={{ marginTop: '10px' , marginBottom: '10px' }}>
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