import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createChatSocket } from "../services/socket";

export default function useChat({
    BACKEND_URL,
    roomId,
    username,
    email,
    accountType,
    leaveChannel
}) {
    // 소켓 및 채팅 관련 상태
    const socketRef = useRef(null);
    const [roomId, setRoomId] = useState('classroom');
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [userCount, setUserCount] = useState(null);
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // 소켓 지연 생성
    const getSocket = useCallback(() => {
        if (!socketRef.current) {
            socketRef.current = createChatSocket(BACKEND_URL);
        }

        return socketRef.current;
    }, [BACKEND_URL]);
    
    const connect = useCallback(() => {
        const socket = getSocket();
        if(socket.connected) return;

        socket.connect();

        socket.on('connect', () => {
            setIsConnected(true);
            console.log("채팅 서버에 연결됨: ", socket.id);
            socket.emit('joinClassroom', {
                roomId,
                email,
                nickname: username,
                accountType
            });
        });

        socket.on('roomInfo', (payload) => {
            setRoomId(payload.roomId);
            setUserCount(payload.count);
            if(payload.locked) setIsChatLocked(payload.locked);
            console.log('룸 정보: ', payload);
        });

        socket.on('classChatMessage', (payload) => {

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

            setMessages((prev) => [...prev, newMessage]);
            console.log('새 채팅 메시지: ', newMessage);
        });

        socket.on('chatMessageDeleted', (payload) => {
            setMessages((prev) => prev.filter((m) => m.id !== payload.id));
            console.log('채팅 메시지 삭제됨: ', payload.id);
        });

        socket.on('chat:lockState', (payload) => {
            setIsChatLocked(payload.locked);
            console.log('채팅 잠금 상태 변경: ', payload.locked);
        });

        socket.on('userList', (payload) => {
            setUsers(payload.users || []);
            console.log('유저 목록 불러옴: ', payload.users);
        });

        socket.on('kicked', () => {
            alert('호스트에 의해 퇴장되었습니다.');
            setIsConnected(false);
            leaveChannel();
            socket.disconnect();
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('채팅 서버와 연결 해제됨');
        });
    }, [getSocket, roomId, email, username, accountType]);

    const disconnect = useCallback(() => {
        const socket = getSocket();
        if (!socket.connected) return;

        socket.off();
        socket.disconnect();
        setIsConnected(false);
        setMessages([]);
        setUsers([]);
    }, [getSocket]);

    // ------ 핸들러들 ------
    const sendMessage = useCallback((text) => {
        const socket = getSocket();
        if (!text?.trim() || !socket.connected) return;
        socket.emit('classChatMessage', text.trim());
    }, [getSocket]);

    const deleteMessage = useCallback((id) => {
        const socket = getSocket();
        if(!socket.connected) {
            setMessages((prev) => prev.filter((m) => m.id !== id));
            return;
        }
        socket.emit('deleteClassChatMessage', id);
    }, [getSocket]);

    const requestUserList = useCallback(() => {
        const socket = getSocket();
        if(socket.connected) socket.emit('userList', roomId);
    }, [getSocket, roomId]);

    const toggleChatLock = useCallback((locked) => {
        const socket = getSocket();
        if (socket.connected) socket.emit('toggleChatLock', { roomId, locked });
    }, [getSocket, roomId]);

    const kickUser = useCallback((socketId) => {
        const socket = getSocket();
        if (socket.connected) {
            socket.emit('kickUser', socketId);
            setUsers((prev) => prev.filter((u) => u.id !== socketId));
        }
    }, [getSocket]);

    useEffect(() => () => disconnect(), [disconnect]);

    return {
        // 상태
        roomId, messages, users, userCount, isChatLocked, isConnected,

        // 제어
        connect, disconnect, sendMessage, deleteMessage, toggleChatLock, requestUserList, kickUser, setRoomId
    }

}