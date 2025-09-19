export default function LocalVideoSection({ localVideoRef, isSharing }) {
    return(
        <div style={{ marginTop: '80px', marginBottom: '30px' }}>
            <h2>내 미디어</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* 화면 공유 */}
            <div>
                <h3>화면 공유</h3>
                <div 
                ref={localVideoRef}
                style={{ 
                    width: '1280px',
                    height: '720px',
                    backgroundColor: '#000', 
                    borderRadius: '8px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    overflow: 'hidden'
                }}
                >
                {!isSharing && '화면 공유가 시작되지 않음'}
                </div>
            </div>

            {/* 카메라 */}
            {/* <div>
                <h3>내 카메라</h3>
                <div 
                ref={localCameraRef}
                style={{ 
                    width: '300px', 
                    height: '225px', 
                    backgroundColor: '#000', 
                    borderRadius: '8px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    overflow: 'hidden'
                }}
                >
                {!isCameraEnabled && '카메라가 비활성화됨'}
                </div>
            </div> */}
            </div>
        </div>
    );
}