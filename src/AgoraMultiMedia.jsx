import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import ChatHeader from './component/ChatHeader';
import UserGuide from './component/UserGuide';
import LocalVideoSection from './component/LocalVideoSection';
import UserControlPanel from './component/UserControlPanel';
import { createChatSocket } from './services/socket';

// Agora 설정
const APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const TOKEN = process.env.REACT_APP_AGORA_APP_TEMP_TOKEN;
// 백엔드 서버 URL
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AgoraMultiMedia = () => {

  // URL 파라미터에서 사용자 이름 가져오기
  const { username } = useParams();

  // Agora 클라이언트 상태
  const [client, setClient] = useState(null);
  
  // 트랙 상태
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localCameraTrack, setLocalCameraTrack] = useState(null);
  
  // 원격 사용자 및 상태
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [channelName, setChannelName] = useState('classroom');
  const [uid, setUid] = useState(null);

  const [isUserPanelOpen, setIsUserPanelOpen] = useState(false); // 인원 관리창 상태

  const localVideoRef = useRef(null); // 로컬 비디오 창 Ref
  const localCameraRef = useRef(null); // 로컬 카메라 창 Ref
  const remoteVideoRefs = useRef({}); // 원격 비디오 창 Ref
  const remoteAudioRefs = useRef({});
  const userControlBtnRef = useRef(null); // 인원 관리 버튼 Ref

  // 소켓 및 채팅 관련 상태
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomId, setRoomId] = useState('classroom');
  const [userCount, setUserCount] = useState(null);
  const [isChatLocked, setIsChatLocked] = useState(false);
  const [users, setUsers] = useState([]);

  // 원격 사용자 목록 업데이트 함수
  function upsertRemote(uid, patch) {
    setRemoteUsers(prev => {
      const i = prev.findIndex(u => u.uid === uid);
      if (i === -1) return [...prev, { uid, videoTrack: null, audioTrack: null, ...patch }];
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

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
      if (mediaType === 'video') {
        upsertRemote(user.uid, { videoTrack: user.videoTrack });
      } else if (mediaType === 'audio') {
        user.audioTrack.play();
        upsertRemote(user.uid, { audioTrack: user.audioTrack });
      }
    });

    let videoUnpubTimers = {};
    agoraClient.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') {
        clearTimeout(videoUnpubTimers[user.uid]);
        videoUnpubTimers[user.uid] = setTimeout(() => {
          // 200~400ms 기다렸다가 여전히 재게시가 없으면 null
          upsertRemote(user.uid, { videoTrack: null });
        }, 300);
      } else if (mediaType === 'audio') {
        upsertRemote(user.uid, { audioTrack: null });
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

    // 토큰 만료전 재발급 이벤트
    agoraClient.on('token-privilege-will-expire', async () => {
      const newToken = await fetch(`${BACKEND_URL}/test/agora/test?channel=${channelName}`)
                            .then(res => res.json())
                            .then(json => json.data.token);
      await agoraClient.renewToken(newToken);
    });

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
      console.log(`채널 참여전`)

      // 채널 참여
      const { uid, token } = await fetch(`${BACKEND_URL}/test/agora/token?channel=${channelName}`)
                          .then(res => res.json())
                          .then(json => json.data);
      
      console.log(`토큰: ${token}`);
      console.log(`UID: ${uid}`);

      const generatedUid = await client.join(APP_ID, channelName, token, uid);
      setUid(generatedUid);
      setIsJoined(true);
      console.log('채널 참여 성공:', generatedUid);

      // 채팅 소켓 연결
      const newSocket = createChatSocket(BACKEND_URL);
      setSocket(newSocket);

      // 소켓 이벤트 리스너 설정
      // 연결 성공 시
      newSocket.on('connect', () => {
        console.log('채팅 서버에 연결됨:', newSocket.id);
        newSocket.emit('joinClassroom', { roomId: `${roomId}`, email: "professor@test.com", nickname: `${username}`, accountType: "PROFESSOR" });
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
        
        // 메시지 객체 생성
        let newMessage = {
          id: payload.id,
          email: payload.email,
          username: payload.username,
          nickname: payload.nickname,
          message: payload.message,
          accountType: payload.accountType,
          timestamp: payload.timestamp
        };

        setMessages(prev => [...prev, newMessage]);
        console.log('새 채팅 메시지: ', newMessage);
      });

      // 채팅 삭제 이벤트 리스너
      newSocket.on('chatMessageDeleted', (payload) => {
        setMessages(prev => prev.filter(msg => msg.id !== payload.id));
        console.log('채팅 메시지 삭제됨: ', payload.id);
      });

      // 채팅 잠금 상태
      newSocket.on('chat:lockState', (payload) => {
        setIsChatLocked(payload.locked);
        console.log('채팅 잠금 상태 변경: ', payload.locked);
      });

      // 같은 소켓 방에 있는 유저 정보 목록 받아오기
      newSocket.on('userList', (payload) => {
        setUsers(payload.users);
        console.log('유저 목록 불러옴: ', payload.users);
      });

      // 강퇴당하였을 경우
      newSocket.on('kicked', () => {
        alert('호스트에 의해 퇴장되었습니다.');
        leaveChannel();
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

  // 채팅 보내기
  const sendMessage = () => {
    const messageInput = document.getElementById('message');
    const message = messageInput.value.trim();
    if (message && socket && socket.connected) {
      socket.emit('classChatMessage', message);
      messageInput.value = '';
    }
  }

  // 채팅 삭제 함수 추가
  const deleteMessage = (messageId) => {
    if (socket && socket.connected) {
      socket.emit('deleteClassChatMessage', messageId);
    } else {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }
  }

  // 채팅 잠금 이벤트 핸들러
  const chatLockToggle = (value) => {
    if (socket && socket.connected) {
      socket.emit('toggleChatLock', { roomId, locked: value });
      console.log(`채팅 잠금 상태: ${value}`);
    }
  }

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
      setMessages([]); // 채팅 초기화
      setRemoteUsers([]);
      setIsUserPanelOpen(false);
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

  // 화면 공유 함수 - 안정성 향상 (Unity 수신을 고려)
  const startScreenShare = async () => {
    if (!client || !isJoined) {
      alert('먼저 채널에 참여해주세요.');
      return;
    }

    try {
      console.log('화면 공유 시작 시도...');
      
      const result = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: 30,
          bitrateMin: 3000,
          bitrateMax: 5000
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

  // 중지 함수
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
    setIsMuted(prev => (!prev));
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

  // 키보드 이벤트 핸들러
  const onHandleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      sendMessage();
    }
  }

  // 인원 관리창 이벤트 핸들러
  const toggleUserControlPanel = async () => {

    // 인원 관리창이 닫혀있는 경우
    if(!isUserPanelOpen){
      // 인원 관리창 열기 전 미리 유저 목록 받아서 상태 업데이트
      socket.emit('userList', roomId);
    }

    setIsUserPanelOpen(prev => !prev);
  }

  // 인원 강퇴 이벤트 핸들러
  const onKickUser = async (socketId) => {
      socket.emit('kickUser', socketId);
      setUsers(prev => prev.filter((user) => user.id !== socketId)); // 인자로 들어온 소켓 아이디와 유저 객체의 소켓 아이디가 다른 것들만 필터링해서 재랜더링
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
          <div style={{ position: "relative", display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
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
            
            {/* 인원 관리 버튼 */}
            <button
              ref={userControlBtnRef}
              onClick= {toggleUserControlPanel}
              style={{
                padding: '10px 20px',
                backgroundColor: '#285be6ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              인원 관리
            </button>
            
            {
              // 인원 관리창
              isUserPanelOpen && <UserControlPanel open = {isUserPanelOpen} users = {users} onKickUser={onKickUser} />
            }
            
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
                  backgroundColor: !isMuted ? '#fd7e14' : '#6c757d', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                {!isMuted ? '음소거' : '음소거 해제'}
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
          {localScreenTrack && (
            <div>화면공유 트랙: {localScreenTrack.isPlaying ? '▶️ 재생중' : '⏸️ 정지'}</div>
          )}
          {localScreenTrack && (
            <div>트랙 상태: {localScreenTrack.enabled ? '활성화' : '비활성화'}</div>
          )}
        </div>
      </div>
      
      {/* 원격 사용자 및 채팅 섹션 */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start'}}>

        {/* 원격 사용자 섹션 */}
        {remoteUsers.length > 0 && (
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
        )}
        
        {/* 채팅 컨테이너 */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          {isJoined && (
            <div style={{ padding: '0 10px 10px 10px', display: 'flex', flexDirection: 'column', border: '1px solid #000000ff', borderRadius: '8px' }}>

              {/* 채팅창 헤더 */}
              <ChatHeader
                roomId={roomId}
                userCount={userCount}
                isChatLocked={isChatLocked}
                onLockToggle={chatLockToggle}
              />

              {/* 채팅창 */}
              <div id="chat">
                {messages.map((msg) => {
                  // Ensure the map returns JSX so messages render
                  console.log('Rendering message:', msg);
                  return (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: '8px',
                        padding: '8px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        border: '1px solid #000000ff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}
                    >
                      {/* 채팅 메세지 */}
                      <div style={{ flex: '1' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
                          {msg.nickname}
                          <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                            {msg.timestamp}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px' }}>{msg.message}</div>
                      </div>

                      {/* 채팅 메세지 삭제 버튼 */}
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        style={{
                          marginLeft: '8px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                        title="메세지 삭제"
                      >
                        삭제
                      </button>

                    </div>
                  );
                })}
              </div>
              <input 
                id="message" 
                type='text' 
                placeholder='채팅 입력 후 Enter'
                onKeyUp={onHandleKeyPress} 
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid' }}/>
            </div>
          )}
        </div>

      </div>

      {/* 로컬 비디오 섹션 */}
      <LocalVideoSection 
        localVideoRef={localVideoRef}
        isSharing={isSharing}
      />

      {/* 사용 방법 */}
      <UserGuide />

    </div>
  );
};

export default AgoraMultiMedia;