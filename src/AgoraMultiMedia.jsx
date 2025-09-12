import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { io } from 'socket.io-client';

// Agora 설정
const APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const TOKEN = process.env.REACT_APP_AGORA_APP_TEMP_TOKEN;

const AgoraMultiMedia = () => {
  const [client, setClient] = useState(null);
  
  // 트랙 상태
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localCameraTrack, setLocalCameraTrack] = useState(null);
  
  // 원격 사용자 및 상태
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [channelName, setChannelName] = useState('classroom');
  const [uid, setUid] = useState(null);

  const localVideoRef = useRef(null);
  const localCameraRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const remoteAudioRefs = useRef({});

  // 소켓 및 채팅 관련 상태
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomId, setRoomId] = useState('classroom');
  const [userCount, setUserCount] = useState(null);
  const [isChatLocked, setIsChatLocked] = useState(false);

  // Agora 클라이언트 초기화 및 이벤트 설정
  useEffect(() => {
    // Agora 클라이언트 초기화
    const agoraClient = AgoraRTC.createClient({ 
      mode: 'rtc', 
      codec: 'vp8',
      role: 'host'
    });

    // 원격 사용자 이벤트 리스너
    agoraClient.on('user-published', async (user, mediaType) => {
      await agoraClient.subscribe(user, mediaType);
      
      console.log(`사용자 ${user.uid}가 ${mediaType}를 게시했습니다.`);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => {
          const existing = prev.find(u => u.uid === user.uid);
          if (existing) {
            return prev.map(u => u.uid === user.uid ? {...u, videoTrack: user.videoTrack} : u);
          }
          return [...prev, user];
        });
      }
      
      if (mediaType === 'audio') {
        // 오디오 자동 재생
        user.audioTrack.play();
        setRemoteUsers(prev => {
          const existing = prev.find(u => u.uid === user.uid);
          if (existing) {
            return prev.map(u => u.uid === user.uid ? {...u, audioTrack: user.audioTrack} : u);
          }
          return [...prev, user];
        });
      }
    });

    agoraClient.on('user-unpublished', (user, mediaType) => {
      console.log(`사용자 ${user.uid}가 ${mediaType} 게시를 중단했습니다.`);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => prev.map(u => 
          u.uid === user.uid ? {...u, videoTrack: null} : u
        ));
      }
      
      if (mediaType === 'audio') {
        setRemoteUsers(prev => prev.map(u => 
          u.uid === user.uid ? {...u, audioTrack: null} : u
        ));
      }
    });

    // 디버깅을 위한 연결 상태 모니터링
    agoraClient.on('connection-state-change', (curState, revState, reason) => {
      console.log(`연결 상태 변경: ${revState} → ${curState}, 이유: ${reason}`);
      
      // Unity 클라이언트 연결 확인
      if (curState === 'CONNECTED') {
        console.log('Unity 클라이언트가 연결될 수 있는 상태입니다');
      }
    });

    // 원격 사용자 감지 (Unity 클라이언트 감지)
    agoraClient.on('user-joined', (user) => {
      console.log(`새로운 사용자 참여: ${user.uid} (Unity 클라이언트일 수 있음)`);
    });

    // 네트워크 품질 모니터링
    // agoraClient.on('network-quality', (stats) => {
    //   // Unity로 전송되는 품질 확인
    //   console.log('네트워크 품질:', stats);
    // });

    // 사용자 채널 퇴장시 처리
    agoraClient.on('user-left', (user) => {
      console.log(`사용자 ${user.uid}가 채널을 떠났습니다.`);
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    setClient(agoraClient);

    return () => {
      if (agoraClient) {
        agoraClient.removeAllListeners();
      }
    };
  }, []);

  // 원격 비디오 재생
  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.videoTrack && remoteVideoRefs.current[user.uid]) {
        user.videoTrack.play(remoteVideoRefs.current[user.uid]);
      }
    });
  }, [remoteUsers]);

  // useEffect에 추가할 트랙 모니터링
  useEffect(() => {
    let interval;
    if (localScreenTrack && isSharing) {
      interval = setInterval(() => {
        const track = localScreenTrack.getMediaStreamTrack();
        if (track && track.readyState === 'ended') {
          console.log('MediaStreamTrack 종료 감지');
          stopScreenShare();
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [localScreenTrack, isSharing]);


  // 채널 참여
  const joinChannel = async () => {
    if (!client || !APP_ID) {
      alert('App ID가 설정되지 않았습니다. APP_ID를 입력해주세요.');
      return;
    }

    try {
      // 채널 참여
      const generatedUid = await client.join(APP_ID, channelName, TOKEN, '1001');
      setUid(generatedUid);
      setIsJoined(true);
      console.log('채널 참여 성공:', generatedUid);

      // 채팅용 백엔드 소켓 연결
      const newSocket = io('http://localhost:3000');
      setSocket(newSocket);

      // 소켓 이벤트 리스너 설정
      // 연결 성공 시
      newSocket.on('connect', () => {
        console.log('채팅 서버에 연결됨:', newSocket.id);
        newSocket.emit('joinClassroom', { roomId: "classroom", nickname: "교수", accountType: "PROFESSOR" });
      });

      // 연결 후 룸 정보 수신
      newSocket.on('roomInfo', (payload) => {
        setRoomId(payload.roomId);
        setUserCount(payload.count);
        if(payload.locked) setIsChatLocked(payload.locked);
        console.log('룸 정보: ', payload);
      });

      // 새로운 채팅 메세지 수신
      newSocket.on('classChatMessage', (payload) => {
        const li = document.createElement('li');
        li.className = 'chat-message';
        li.textContent = `${payload.nickname}: ${payload.message}`;
        document.getElementById('chat').appendChild(li);
        setMessages(prev => [...prev, payload]);
        console.log('새 채팅 메시지: ', payload);
      });

      // 채팅 잠금 상태
      newSocket.on('chat:lockState', (payload) => {
        setIsChatLocked(payload.locked);
        console.log('채팅 잠금 상태 변경: ', isChatLocked);
      });

      // 연결 해제 시
      newSocket.on('disconnect', () => {
        console.log('채팅 서버와 연결 해제됨');
        setSocket(null);
      });

    } catch (error) {
      console.error('채널 참여 실패:', error);
      alert('채널 참여에 실패했습니다.');                        
    }
  };

  // 채널 떠나기
  const leaveChannel = async () => {
    if (!client) return;

    try {
      // 모든 트랙 정리
      if (isSharing) await stopScreenShare();
      if (isAudioEnabled) await stopAudio();
      if (isCameraEnabled) await stopCamera();

      // 채널 떠나기
      await client.leave();
      setIsJoined(false);
      setUid(null);
      setRemoteUsers([]);
      console.log('채널을 떠났습니다.');

      // 소켓 연결 해제
      if (socket && socket.connected) {
        socket.disconnect();
        console.log("채팅 서버 연결 해제됨");
      }
    } catch (error) {
      console.error('채널 떠나기 실패:', error);
    }
  };

  // 개선된 화면 공유 함수 - 안정성 향상 (Unity 수신을 고려)
  const startScreenShare = async () => {
    if (!client || !isJoined) {
      alert('먼저 채널에 참여해주세요.');
      return;
    }

    try {
      console.log('화면 공유 시작 시도...');
      
      const result = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: 15,
          bitrateMin: 1000,
          bitrateMax: 3000
        },
        optimizationMode: "detail"
      }, "auto");

      const screenTrack = Array.isArray(result) ? result[0] : result;
      
      console.log('화면 트랙 생성 완료:', {
        trackId: screenTrack.getTrackId(),
        enabled: screenTrack.enabled,
        muted: screenTrack.muted
      });

      // 트랙 상태 변경 이벤트 리스너 추가
      screenTrack.on("track-ended", () => {
        console.log('화면 공유가 종료됨 (사용자 취소 또는 시스템)');
        stopScreenShare();
      });

      screenTrack.on("player-status-change", (evt) => {
        console.log('플레이어 상태 변경:', evt);
      });

      // 먼저 채널에 publish (이게 더 안정적)
      console.log('채널에 화면 트랙 게시 중...');
      await client.publish(screenTrack);
      console.log('채널 게시 완료');

      // 상태 업데이트
      setLocalScreenTrack(screenTrack);
      setIsSharing(true);

      // 로컬 재생은 나중에 시도 (선택사항)
      setTimeout(async () => {
        if (localVideoRef.current && screenTrack) {
          try {
            console.log('로컬 재생 시도...');
            await screenTrack.play(localVideoRef.current);
            console.log('로컬 재생 성공');
            
            // 비디오 엘리먼트 스타일 조정
            const videoElement = localVideoRef.current.querySelector('video');
            if (videoElement) {
              videoElement.style.width = '100%';
              videoElement.style.height = '100%';
              videoElement.style.objectFit = 'contain';
              videoElement.style.backgroundColor = '#000';
            }
          } catch (playError) {
            console.log('로컬 재생 실패 (정상):', playError.message);
            // 로컬 재생 실패시 상태 메시지 표시
            if (localVideoRef.current) {
              localVideoRef.current.innerHTML = `
                <div style="
                  display: flex; 
                  align-items: center; 
                  justify-content: center; 
                  height: 100%; 
                  color: white; 
                  font-size: 16px;
                  text-align: center;
                  flex-direction: column;
                  background-color: #1a1a1a;
                ">
                  <div style="font-size: 24px; margin-bottom: 10px;">🖥️</div>
                  <div>화면 공유 진행 중</div>
                  <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
                    다른 참가자들이 화면을 볼 수 있습니다
                  </div>
                  <div style="font-size: 10px; margin-top: 4px; opacity: 0.6;">
                    Track ID: ${screenTrack.getTrackId()}
                  </div>
                </div>
              `;
            }
          }
        }
      }, 1000);

    } catch (error) {
      console.error('화면 공유 시작 실패:', error);
      setIsSharing(false);
      
      if (error.name === 'NotAllowedError') {
        alert('화면 공유 권한이 거부되었습니다.');
      } else if (error.name === 'AbortError') {
        alert('화면 공유가 취소되었습니다.');
      } else if (error.message.includes('Permission denied')) {
        alert('화면 공유 권한을 확인해주세요.');
      } else {
        alert(`화면 공유 오류: ${error.message}`);
      }
    }
  };

  // 개선된 중지 함수
  const stopScreenShare = async () => {
    if (!localScreenTrack) return;

    try {
      console.log('화면 공유 중지 시작...');
      
      // 이벤트 리스너 제거
      localScreenTrack.removeAllListeners();
      
      // unpublish 먼저
      if (client) {
        await client.unpublish(localScreenTrack);
        console.log('채널에서 unpublish 완료');
      }
      
      // 트랙 중지 및 해제
      localScreenTrack.stop();
      localScreenTrack.close();
      
      console.log('트랙 정리 완료');
      
      // UI 초기화
      if (localVideoRef.current) {
        localVideoRef.current.innerHTML = '화면 공유가 시작되지 않음';
      }
      
      setLocalScreenTrack(null);
      setIsSharing(false);
      
    } catch (error) {
      console.error('화면 공유 중지 실패:', error);
      // 강제로 상태 초기화
      setLocalScreenTrack(null);
      setIsSharing(false);
    }
  };

  // 추가: 트랙 상태 모니터링 함수
  const monitorScreenTrack = () => {
    if (localScreenTrack) {
      const status = {
        trackId: localScreenTrack.getTrackId(),
        enabled: localScreenTrack.enabled,
        muted: localScreenTrack.muted,
        isPlaying: localScreenTrack.isPlaying,
        readyState: localScreenTrack.getMediaStreamTrack()?.readyState
      };
      console.log('Screen track status:', status);
      return status;
    }
    return null;
  };

  // 오디오 기능
  const startAudio = async () => {
    if (!client || !isJoined) {
      alert('먼저 채널에 참여해주세요.');
      return;
    }

    try {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "music_standard",
      });

      await client.publish(audioTrack);
      setLocalAudioTrack(audioTrack);
      setIsAudioEnabled(true);
      console.log('마이크 활성화됨');
    } catch (error) {
      console.error('마이크 활성화 실패:', error);
      alert('마이크 권한을 확인해주세요.');
    }
  };

  // 오디오 중지
  const stopAudio = async () => {
    if (!localAudioTrack) return;

    try {
      await client.unpublish(localAudioTrack);
      localAudioTrack.stop();
      localAudioTrack.close();
      
      setLocalAudioTrack(null);
      setIsAudioEnabled(false);
      console.log('마이크 비활성화됨');
    } catch (error) {
      console.error('마이크 비활성화 실패:', error);
    }
  };

  // 음소거 토글
  const toggleMute = async () => {
    if (!localAudioTrack) return;
    
    await localAudioTrack.setEnabled(!localAudioTrack.enabled);
    console.log(`마이크 ${localAudioTrack.enabled ? '음소거 해제' : '음소거'}`);
  };

  // 카메라 기능
  const startCamera = async () => {
    if (!client || !isJoined) {
      alert('먼저 채널에 참여해주세요.');
      return;
    }

    try {
      const cameraTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "480p_1",
      });

      await client.publish(cameraTrack);
      
      if (localCameraRef.current) {
        cameraTrack.play(localCameraRef.current);
      }

      setLocalCameraTrack(cameraTrack);
      setIsCameraEnabled(true);
      console.log('카메라 활성화됨');
    } catch (error) {
      console.error('카메라 활성화 실패:', error);
      alert('카메라 권한을 확인해주세요.');
    }
  };
  const stopCamera = async () => {
    if (!localCameraTrack) return;

    try {
      await client.unpublish(localCameraTrack);
      localCameraTrack.stop();
      localCameraTrack.close();
      
      setLocalCameraTrack(null);
      setIsCameraEnabled(false);
      console.log('카메라 비활성화됨');
    } catch (error) {
      console.error('카메라 비활성화 실패:', error);
    }
  };

  // 채팅 보내기
  const sendMessage = () => {
    const messageInput = document.getElementById('message');
    const message = messageInput.value.trim();
    if (message && socket && socket.connected) {
      socket.emit('classChatMessage', message);
      messageInput.value = '';
    }
  }

  // 키보드 이벤트 핸들러
  const onHandleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>VEATRA 강의실 멀티미디어 통합관리</h1>
      
      {/* 설정 섹션 */}
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
        <div style={{ color: '#666', fontSize: '12px' }}>
          App ID: {APP_ID || '설정되지 않음'}
        </div>
      </div>

      {/* 컨트롤 버튼 */}
      <div style={{ marginBottom: '20px' }}>
        {!isJoined ? (
          <button 
            onClick={joinChannel}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            채널 참여
          </button>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button 
              onClick={leaveChannel}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              채널 떠나기
            </button>
            
            {/* 화면 공유 버튼 */}
            <button 
              onClick={isSharing ? stopScreenShare : startScreenShare}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: isSharing ? '#ffc107' : '#28a745', 
                color: isSharing ? 'black' : 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {isSharing ? '화면 공유 중지' : '화면 공유 시작'}
            </button>

            {/* 오디오 버튼 */}
            <button 
              onClick={isAudioEnabled ? stopAudio : startAudio}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: isAudioEnabled ? '#6f42c1' : '#17a2b8', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {isAudioEnabled ? '마이크 끄기' : '마이크 켜기'}
            </button>

            {/* 음소거 버튼 */}
            {isAudioEnabled && (
              <button 
                onClick={toggleMute}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: localAudioTrack?.enabled ? '#fd7e14' : '#6c757d', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                {localAudioTrack?.enabled ? '음소거' : '음소거 해제'}
              </button>
            )}

            {/* 카메라 버튼 */}
            {/* <button 
              onClick={isCameraEnabled ? stopCamera : startCamera}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: isCameraEnabled ? '#e83e8c' : '#20c997', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {isCameraEnabled ? '카메라 끄기' : '카메라 켜기'}
            </button> */}
          </div>
        )}
      </div>

      {/* 상태 정보 */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>상태: {isJoined ? `채널 "${channelName}"에 참여중` : '채널에 참여하지 않음'}</div>
          <div>UID: {uid || 'N/A'}</div>
          <div>화면 공유: {isSharing ? '✅ 진행중' : '❌ 중지됨'}</div>
          <div>마이크: {isAudioEnabled ? (localAudioTrack?.enabled ? '🎤 활성' : '🔇 음소거') : '❌ 비활성'}</div>
          {/* <div>카메라: {isCameraEnabled ? '📹 활성' : '❌ 비활성'}</div> */}
          <div>원격 사용자: {remoteUsers.length}명</div>
          {localScreenTrack && (
            <div>화면공유 트랙: {localScreenTrack.isPlaying ? '▶️ 재생중' : '⏸️ 정지'}</div>
          )}
          {localScreenTrack && (
            <div>트랙 상태: {localScreenTrack.enabled ? '활성화' : '비활성화'}</div>
          )}
        </div>
      </div>

      {/* 로컬 비디오 섹션 */}
      <div style={{ marginBottom: '30px' }}>
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

          {/* 채팅창 */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            {isJoined && (
              <div style={{ height: '720px' }}>
                <h3>채팅창 ({roomId}) - 사용자 {userCount}명 {isChatLocked ? '🔒' : '🔓'}</h3>
                <ul id="chat"></ul>
                <input id="message" type='text' placeholder='채팅 입력 후 Enter' onKeyUp={onHandleKeyPress} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '2px solid' }}/>
              </div>
            )}
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

      {/* 원격 사용자 섹션 */}
      {remoteUsers.length > 0 && (
        <div>
          <h2>원격 사용자들</h2>
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
                    width: '400px', 
                    height: '300px', 
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
      )}

      {/* 사용 방법 */}
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#d1ecf1', borderRadius: '8px' }}>
        <h3>사용 방법:</h3>
        <ol>
          <li><strong>App ID 설정:</strong> 코드 상단의 APP_ID를 실제 Agora App ID로 변경하세요</li>
          <li><strong>채널 참여:</strong> "채널 참여" 버튼으로 채널에 입장하세요</li>
          <li><strong>기능 활성화:</strong> 필요한 기능들(화면공유, 마이크, 카메라)을 개별적으로 켜고 끄세요</li>
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

        <p style={{ color: '#856404', marginTop: '10px' }}>
          <strong>참고:</strong> 모든 기능(화면공유, 음성, 영상)을 같은 채널에서 동시에 사용할 수 있습니다!
        </p>
      </div>
    </div>
  );
};

export default AgoraMultiMedia;