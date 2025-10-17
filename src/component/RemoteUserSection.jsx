export default function RemoteUserSection({
    remoteUsers,
    remoteVideoRefs
}) {
    return(
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              {remoteUsers.map(user => (
                <div key={user.uid} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                  <h3>사용자 {user.uid}</h3>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ marginRight: '15px' }}>
                      📹 비디오: {user.videoTrack ? '✅' : '❌'}
                    </span>
                    <span>
                      🎤 오디오: {user.audioTrack ? '✅' : '❌'}
                    </span>
                  </div>
                  <div 
                    ref={el => remoteVideoRefs.current[user.uid] = el}
                    style={{ 
                      width: '1260px', 
                      height: '680px',
                      backgroundColor: '#000', 
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}
                  >
                    {!user.videoTrack && '비디오 없음'}
                  </div>
                </div>
              ))}
            </div>
        </div>
    );
}