import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input, Tag, Image, Tooltip, Popconfirm, message, Table, Alert } from 'antd';
import {
  InfoCircleOutlined,
  SketchOutlined,
  RiseOutlined,
  ShoppingCartOutlined,
  DiscordOutlined,
  TrophyOutlined,
  GiftOutlined,
  UserAddOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  DollarCircleOutlined,
  AuditOutlined // 核實圖示
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import formatNumber from '../utils/formatNumber';
import 'moment/locale/zh-tw';
import logger from '../utils/logger';
moment.locale('zh-tw');

const BASE_URL = 'http://localhost:5000';

const statusMap = {
  active: '活躍',
  pending: '待處理',
  completed: '已完成',
  cancelled: '已取消',
  settled: '已結算',
  unknown: '未知',
};

const colorMapping = {
  '白色': '#f0f0f0',
  '綠色': '#00cc00',
  '藍色': '#1e90ff',
  '紅色': '#EC3636',
  '紫色': '#B931F3',
  '金色': '#ffeb3b',
};

const AuctionList = ({ auctions, fetchAuctions, userRole, userId, handleSettleAuction, isWonTab = false }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bids, setBids] = useState({});
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [characterName, setCharacterName] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);
  const [localUserRole, setLocalUserRole] = useState(null); // 本地狀態存儲 userRole
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchUserInfo();
  }, [auctions, token]);

  const fetchUserInfo = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/users/me`, {
        headers: { 'x-auth-token': token },
      });
      setUserDiamonds(res.data.diamonds || 0);
      setCharacterName(res.data.character_name);
      setLocalUserRole(res.data.role || 'user'); // 設置本地 userRole
      logger.info('Fetched user info in AuctionList', { userId: res.data.id, character_name: res.data.character_name, role: res.data.role });
    } catch (err) {
      logger.error('Fetch user info error in AuctionList', { error: err.message, stack: err.stack });
      message.error('無法獲取用戶信息，請重新登錄');
      navigate('/login');
    }
  };

  const fetchBids = async (auctionId) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/auctions/${auctionId}/bids`, {
        headers: { 'x-auth-token': token },
      });
      logger.info(`Fetched bids for auction ${auctionId}`, { count: res.data.length });
      setBids(prev => ({ ...prev, [auctionId]: res.data }));
    } catch (err) {
      logger.error(`Error fetching bids for auction ${auctionId}`, { error: err.response?.data || err.message, stack: err.stack });
      message.error('無法獲取下標歷史，請刷新頁面後重試！');
      setBids(prev => ({ ...prev, [auctionId]: [] }));
    }
  };

  const sendSystemNotification = async (userIdToNotify, auctionId, itemName, amount) => {
    try {
      const messageContent = `您已成功投得競標 [${auctionId}] 的物品 [${itemName}]，得標金額為 ${formatNumber(amount)} 💎。`;
      const res = await axios.post(
        `${BASE_URL}/api/notifications`,
        {
          userId: userIdToNotify,
          message: messageContent,
          type: 'system',
          auctionId,
        },
        { headers: { 'x-auth-token': token } }
      );
      logger.info('System notification sent', { userId: userIdToNotify, auctionId });
    } catch (err) {
      logger.error('Send system notification error', { error: err.response?.data || err.message, stack: err.stack });
      message.warning('系統消息發送失敗，但競標操作已完成');
    }
  };

  const getStatusTag = (status) => {
    let color, text;
    switch (status) {
      case 'active':
        color = 'green';
        text = '活躍';
        break;
      case 'pending':
        color = 'orange';
        text = '待處理';
        break;
      case 'completed':
        color = 'blue';
        text = '已完成';
        break;
      case 'cancelled':
        color = 'red';
        text = '已取消';
        break;
      case 'settled':
        color = 'purple';
        text = '已結算';
        break;
      default:
        color = 'default';
        text = statusMap[status] || statusMap['unknown'];
    }
    return (
      <Tag
        color={color}
        style={{
          borderRadius: '12px',
          padding: '2px 12px',
          fontWeight: 'bold',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        {text}
      </Tag>
    );
  };

  const handleCancelAuction = async (auctionId) => {
    try {
      logger.info('User clicked cancel auction button', { auctionId, userId });
      const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/cancel`, {}, {
        headers: { 'x-auth-token': token },
      });
      message.success(res.data.msg);
      logger.info('Auction cancelled successfully', { auctionId, userId, response: res.data });
      fetchAuctions();
    } catch (err) {
      logger.error('Cancel auction error', { auctionId, userId, error: err.response?.data || err.message, stack: err.stack });
      message.error(`取消拍賣失敗: ${err.response?.data?.msg || err.message}`);
    }
  };

  const handleReassignAuction = async (auctionId) => {
    try {
      logger.info('User clicked reassign auction button', { auctionId, userId });
      const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/reassign`, {}, {
        headers: { 'x-auth-token': token },
      });
      message.success(res.data.msg);
      logger.info('Auction reassigned successfully', { auctionId, userId, response: res.data });
      fetchAuctions();
    } catch (err) {
      logger.error('Reassign auction error', { auctionId, userId, error: err.response?.data || err.message, stack: err.stack });
      message.error(`重新分配拍賣失敗: ${err.response?.data?.msg || err.message}`);
    }
  };

  const handleCompleteTransaction = async (auctionId) => {
    try {
      logger.info('User clicked complete transaction button', { auctionId, userId, characterName });
      const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/complete-transaction`, {}, {
        headers: { 'x-auth-token': token },
      });
      message.success(res.data.msg);
      logger.info('Transaction completed successfully', { auctionId, userId, characterName, response: res.data });
      fetchAuctions();
    } catch (err) {
      logger.error('Complete transaction error', { auctionId, userId, characterName, error: err.response?.data || err.message, stack: err.stack });
      message.error(`回報交易完成失敗: ${err.response?.data?.msg || err.message}`);
    }
  };

  const handleBidClick = (auction) => {
    logger.info('User clicked bid button', { auctionId: auction._id, userId });
    if (!auction || !auction._id) {
      message.error('無法找到拍賣信息，請刷新頁面！');
      return;
    }
    setSelectedAuction(auction);
    setIsModalVisible(true);
  };

  const handleHistoryClick = (auctionId) => {
    logger.info('User clicked history button', { auctionId, userId });
    setSelectedAuctionId(auctionId);
    fetchBids(auctionId);
    setHistoryModalVisible(true);
  };

  const handleHistoryModalClose = () => {
    setHistoryModalVisible(false);
    setSelectedAuctionId(null);
  };

  const handleBidSubmit = async () => {
    if (!bidAmount) {
      message.error('請輸入下標金額！');
      return;
    }
    if (isNaN(bidAmount) || parseInt(bidAmount) <= 0) {
      message.error('下標金額必須為正整數！');
      return;
    }

    const bidValue = parseInt(bidAmount);
    const currentPrice = selectedAuction?.currentPrice || 0;

    if (bidValue === currentPrice) {
      message.error(`下標金額不能等於當前價格 {formatNumber(currentPrice)} 💎，請輸入更高的金額！`);
      return;
    }
    if (bidValue < currentPrice) {
      message.error(`下標金額必須大於當前價格 {formatNumber(currentPrice)} 💎！`);
      return;
    }

    try {
      logger.info('Checking auction status before bidding', { auctionId: selectedAuction._id, userId });
      const resCheck = await axios.get(`${BASE_URL}/api/auctions/${selectedAuction._id}`, {
        headers: { 'x-auth-token': token },
      });
      const latestAuction = resCheck.data;
      if (!latestAuction) {
        throw new Error('拍賣不存在');
      }
      if (latestAuction.status !== 'active') {
        message.error(`拍賣已結束或被取消，當前狀態為 ${statusMap[latestAuction.status] || latestAuction.status}，無法下標。請刷新頁面後重試。`);
        return;
      }

      logger.info('Sending bid request', { auctionId: selectedAuction._id, amount: bidValue, userId });

      const res = await axios.post(
        `${BASE_URL}/api/auctions/${selectedAuction._id}/bid`,
        { amount: bidValue },
        { headers: { 'x-auth-token': token } }
      );

      const finalPrice = res.data.finalPrice || bidValue;
      const isBuyout = res.data.msg.includes('已直接得標');

      if (isBuyout) {
        message.success('下標成功，已直接得標！競標已結束。');
        await sendSystemNotification(userId, selectedAuction._id, selectedAuction.itemName, finalPrice);
      } else {
        message.success(`下標成功！您已下標 {formatNumber(finalPrice)} 💎，請確保結算前餘額足夠（當前餘額：{formatNumber(userDiamonds)} 💎）。`);
      }

      await fetchAuctions();
      await fetchBids(selectedAuction._id);

      if (historyModalVisible && selectedAuctionId === selectedAuction._id) {
        setHistoryModalVisible(false);
        setTimeout(() => {
          setHistoryModalVisible(true);
        }, 0);
      }

      setIsModalVisible(false);
      setBidAmount('');
    } catch (err) {
      logger.error('Bid error', { auctionId: selectedAuction?._id, userId, error: err.response?.data || err.message, stack: err.stack });

      if (err.response) {
        const status = err.response.status;
        const errorMsg = err.response.data?.msg || '未知錯誤';
        const detail = err.response.data?.detail || '';

        switch (status) {
          case 400:
            message.error(`${errorMsg}${detail ? `：${detail}` : ''}`);
            break;
          case 401:
            message.error('認證失敗，請重新登錄！');
            setTimeout(() => {
              navigate('/login');
            }, 2000);
            break;
          case 403:
            message.error('您無權進行此操作！');
            break;
          case 404:
            message.error(`拍賣不存在，請刷新頁面後重試！${detail ? `（${detail}）` : ''}`);
            fetchAuctions();
            break;
          case 500:
            message.error('伺服器錯誤，請稍後重試！');
            break;
          default:
            message.error(`下標失敗：${errorMsg}${detail ? `（${detail}）` : ''}`);
            break;
        }
      } else if (err.request) {
        message.error('網絡錯誤，請檢查您的網絡連線！');
      } else {
        message.error(`下標失敗：${err.message}`);
      }
    }
  };

  const bidColumns = [
    {
      title: '下標者',
      dataIndex: 'userId',
      key: 'userId',
      render: (user) => (
        <span>{user?.character_name || '未知用戶'}</span>
      ),
    },
    {
      title: '下標金額',
      dataIndex: 'amount',
      key: 'amount',
      sorter: (a, b) => b.amount - a.amount,
      render: (amount, record, index) => {
        const isHighestBid = index === 0;
        return (
          <span style={{ color: isHighestBid ? '#52c41a' : '#000', fontWeight: isHighestBid ? 'bold' : 'normal' }}>
            {formatNumber(amount)} 💎
          </span>
        );
      },
    },
    {
      title: '下標時間',
      dataIndex: 'timestamp',
      key: 'timestamp',
      sorter: (a, b) => moment(a.timestamp).unix() - moment(b.timestamp).unix(),
      render: (time) => {
        if (!time) return '無時間記錄';
        const now = moment();
        const createdMoment = moment(time);
        const duration = now.diff(createdMoment);
        if (duration < 60000) {
          return (
            <Tooltip title={createdMoment.format('YYYY-MM-DD HH:mm:ss')}>
              {createdMoment.format('YYYY-MM-DD HH:mm:ss')}
            </Tooltip>
          );
        }
        return (
          <Tooltip title={createdMoment.format('YYYY-MM-DD HH:mm:ss')}>
            {createdMoment.fromNow()}
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div>
      {auctions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>您目前沒有得標或持有的拍賣。</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {auctions.map(auction => {
            const levelColor = auction.level ? colorMapping[auction.level.color] || '#000000' : '#000000';
            const bidsForAuction = bids[auction._id] || [];
            const sortedBids = [...bidsForAuction].sort((a, b) => b.amount - a.amount);
            const endTime = auction.endTime ? moment(auction.endTime).format('MM-DD HH:mm') : '無截止時間';
            const remainingTime = auction.endTime
              ? moment(auction.endTime).diff(moment()) <= 0
                ? '已結束'
                : `${Math.floor(moment.duration(moment(auction.endTime).diff(moment())).asHours())}小時${moment.duration(moment(auction.endTime).diff(moment())).minutes()}分`
              : '無截止時間';
            const isItemHolder = auction.itemHolder === characterName;

            // 調試日誌
            //logger.debug('Auction itemHolder check', { auctionId: auction._id, itemHolder: auction.itemHolder, characterName });
            //logger.debug('Auction status check', { auctionId: auction._id, status: auction.status, isItemHolder, shouldShowCompleteButton: isItemHolder && auction.status === 'completed', userRole: localUserRole });
            //logger.debug('Settle button check', { auctionId: auction._id, status: auction.status, userRole: localUserRole, shouldShowSettleButton: localUserRole === 'admin' && auction.status === 'pending' });

            // 如果按鈕未顯示，添加警告日誌
            if (isWonTab && !isItemHolder) {
              logger.warn('Complete transaction button not shown: user is not item holder', { auctionId: auction._id, itemHolder: auction.itemHolder, characterName });
            }
            if (isWonTab && auction.status !== 'completed') {
              logger.warn('Complete transaction button not shown: auction status is not completed', { auctionId: auction._id, status: auction.status });
            }
            if (isWonTab && localUserRole === 'admin' && auction.status !== 'pending') {
              logger.warn('Settle button not shown: auction status is not pending', { auctionId: auction._id, status: auction.status });
            }

            // 核實按鈕是否應該顯示
            const shouldShowSettleButton = localUserRole === 'admin' && auction.status === 'pending';
            //logger.debug('Rendering settle button', { auctionId: auction._id, shouldShowSettleButton });

            return (
              <Card
                key={auction._id}
                hoverable
                style={{
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  backgroundColor: '#fff',
                }}
                cover={
                  <div style={{ position: 'relative', width: '100%', paddingTop: '66.67%' }}>
                    <Image
                      src={auction.imageUrl}
                      alt={auction.itemName}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        logger.error('Image load error', { imageUrl: auction.imageUrl, error: e.message });
                        message.warning('圖片加載失敗，使用占位圖');
                      }}
                    />
                    {auction.status === 'active' && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '0px',
                          right: '0px',
                          backgroundColor: 'rgba(48, 189, 106, 0.93)',
                          color: 'white',
                          padding: '3px 6px',
                          borderRadius: '0px',
                          fontSize: '12px',
                          zIndex: 2,
                        }}
                      >
                        {remainingTime}
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'rgba(255, 255, 255, 0.97)',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        wordBreak: 'break-all',
                        lineHeight: '1.5',
                        width: '80%',
                        textShadow: '1px 1px 2px rgb(255, 255, 255)',
                        textAlign: 'center',
                      }}
                    >
                      [{endTime}]<br />
                      <span style={{ color: levelColor }}>{auction.itemName || '未知物品'}</span>
                    </div>
                  </div>
                }
                actions={
                  isWonTab ? [
                    localUserRole === 'admin' && auction.status === 'pending' && (
                      <Popconfirm
                        key="settle"
                        title="確認核實此拍賣？"
                        onConfirm={() => {
                          logger.info('Settle button clicked', { auctionId: auction._id, userId });
                          handleSettleAuction(auction._id);
                        }}
                        okText="是"
                        cancelText="否"
                      >
                        <Tooltip title="核實交易">
                          <Button
                            type="default"
                            shape="circle"
                            icon={<AuditOutlined />}
                            size="small"
                          // 移除可能的 disabled 屬性，確保按鈕可點擊
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                    isItemHolder && auction.status === 'completed' && (
                      <Popconfirm
                        key="complete"
                        title="確認交易已完成？"
                        onConfirm={() => handleCompleteTransaction(auction._id)}
                        okText="是"
                        cancelText="否"
                      >
                        <Tooltip title="交易完成">
                          <Button
                            type="primary"
                            shape="circle"
                            icon={<CheckCircleOutlined />}
                            size="small"
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                  ].filter(Boolean) : [
                    <Tooltip key="bid" title="下標">
                      <Button
                        type="primary"
                        shape="circle"
                        icon={<DollarCircleOutlined />}
                        size="small"
                        onClick={() => handleBidClick(auction)}
                        disabled={auction.status !== 'active'}
                      />
                    </Tooltip>,
                    <Tooltip key="history" title="詳細">
                      <Button
                        type="default"
                        shape="circle"
                        icon={<HistoryOutlined />}
                        size="small"
                        onClick={() => handleHistoryClick(auction._id)}
                      />
                    </Tooltip>,
                    localUserRole === 'admin' && auction.status !== 'completed' && auction.status !== 'cancelled' && (
                      <Popconfirm
                        key="settle"
                        title="確認結算此拍賣？"
                        onConfirm={() => handleSettleAuction(auction._id)}
                        okText="是"
                        cancelText="否"
                        disabled={auction.status !== 'active' && auction.status !== 'completed'}
                      >
                        <Tooltip title="結算">
                          <Button
                            type="default"
                            shape="circle"
                            icon={<DollarOutlined />}
                            size="small"
                            disabled={auction.status !== 'active' && auction.status !== 'completed'}
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                    localUserRole === 'admin' && auction.status !== 'completed' && auction.status !== 'cancelled' && (
                      <Popconfirm
                        key="cancel"
                        title="確認取消此拍賣？"
                        onConfirm={() => handleCancelAuction(auction._id)}
                        okText="是"
                        cancelText="否"
                        disabled={auction.status !== 'active' && auction.status !== 'pending'}
                      >
                        <Tooltip title="取消">
                          <Button
                            type="danger"
                            shape="circle"
                            icon={<CloseCircleOutlined />}
                            size="small"
                            disabled={auction.status !== 'active' && auction.status !== 'pending'}
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                    localUserRole === 'admin' && auction.status === 'pending' && (
                      <Popconfirm
                        key="reassign"
                        title="確認重新分配此拍賣？"
                        onConfirm={() => handleReassignAuction(auction._id)}
                        okText="是"
                        cancelText="否"
                        disabled={auction.status !== 'pending'}
                      >
                        <Tooltip title="重新分配">
                          <Button
                            type="default"
                            shape="circle"
                            icon={<SyncOutlined />}
                            size="small"
                            disabled={auction.status !== 'pending'}
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                  ]
                }
              >
                <Card.Meta
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {isWonTab ? (
                        <>
                          {/* 得標金額 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrophyOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                            <span style={{ color: '#1890ff', fontSize: '16px' }}>{formatNumber(auction.currentPrice)}</span>
                          </div>
                          {/* 物品持有人 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <GiftOutlined style={{ color: '#000', fontSize: '16px' }} />
                            <span>{auction.itemHolder || auction.createdBy.character_name}</span>
                          </div>
                          {/* 聯絡方式 */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <DiscordOutlined style={{ color: '#000', fontSize: '16px', marginTop: '2px' }} />
                            <div>
                              {auction.createdBy.lineId && (
                                <div>LINE: {auction.createdBy.lineId}</div>
                              )}
                              {auction.createdBy.discordId && (
                                <div>Discord: {auction.createdBy.discordId}</div>
                              )}
                              {!auction.createdBy.lineId && !auction.createdBy.discordId && (
                                <div>無聯絡方式</div>
                              )}
                            </div>
                          </div>
                          {/* 狀態 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <InfoCircleOutlined style={{ color: '#000', fontSize: '16px' }} />
                            {getStatusTag(auction.status)}
                          </div>
                          {/* 提示信息 */}
                          {isItemHolder && auction.status === 'pending' && localUserRole !== 'admin' && (
                            <Alert
                              message="等待管理員核實"
                              description="此拍賣正在等待管理員核實交易，核實完成後您可以回報交易完成。"
                              type="info"
                              showIcon
                              style={{ marginTop: '8px' }}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          {/* 起標 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <SketchOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                            <span style={{ color: '#1890ff', fontSize: '16px' }}>{formatNumber(auction.startingPrice) || 0}</span>
                          </div>
                          {/* 當前價格 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RiseOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                            <span style={{ color: '#1890ff', fontSize: '16px' }}>{formatNumber(auction.currentPrice) || 0}</span>
                          </div>
                          {/* 直接得標價 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShoppingCartOutlined style={{ color: '#000', fontSize: '16px' }} />
                            <span>{auction.buyoutPrice ? formatNumber(auction.buyoutPrice) : '無'}</span>
                          </div>
                          {/* 最高下標者 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserAddOutlined style={{ color: '#000', fontSize: '16px' }} />
                            <span>{auction.highestBidder?.character_name || '無'}</span>
                          </div>
                          {/* 狀態 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <InfoCircleOutlined style={{ color: '#000', fontSize: '16px' }} />
                            {getStatusTag(auction.status)}
                          </div>
                        </>
                      )}
                    </div>
                  }
                />
              </Card>
            );
          })}
        </div>
      )}

      {/* 出價 Modal */}
      <Modal
        title={`為 ${selectedAuction?.itemName || '未知物品'} 下標`}
        open={isModalVisible}
        onOk={handleBidSubmit}
        onCancel={() => {
          setIsModalVisible(false);
          setBidAmount('');
        }}
        okText="下標"
        cancelText="取消"
      >
        <p>當前價格: {formatNumber(selectedAuction?.currentPrice) || 0} 💎</p>
        {selectedAuction?.buyoutPrice && (
          <p>直接得標價: {formatNumber(selectedAuction.buyoutPrice)} 💎</p>
        )}
        <Input
          type="number"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder="輸入下標金額"
          min={(selectedAuction?.currentPrice || 0) + 1}
          style={{ margin: '10px 0' }}
        />
        {bidAmount && parseInt(bidAmount) > userDiamonds && (
          <p style={{ color: 'red' }}>
            警告：您的餘額（{formatNumber(userDiamonds)} 💎）低於下標金額（{formatNumber(bidAmount)} 💎），請確保結算前充值！
          </p>
        )}
        <p>注意：下標後，💎將在結算時扣除。您的餘額：{formatNumber(userDiamonds)} 💎</p>
      </Modal>

      {/* 出價歷史 Modal */}
      <Modal
        title="下標歷史"
        open={historyModalVisible}
        onCancel={handleHistoryModalClose}
        footer={[
          <Button key="close" onClick={handleHistoryModalClose}>
            關閉
          </Button>,
        ]}
        width={800}
      >
        <Table
          columns={bidColumns}
          dataSource={selectedAuctionId ? (bids[selectedAuctionId] || []).sort((a, b) => b.amount - a.amount) : []}
          rowKey="_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
            showTotal: (total) => `共 ${total} 條記錄`,
          }}
          locale={{ emptyText: '暫無下標記錄' }}
          style={{
            background: '#f5f5f5',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
          rowClassName={(record, index) => (index === 0 ? 'highest-bid-row' : '')}
        />
      </Modal>

      <style jsx global>{`
                .highest-bid-row {
                    background-color: #e6f7e5 !important;
                }
                .highest-bid-row td {
                    border-bottom: 1px solid #d9d9d9 !important;
                }
                .ant-table-expanded-row .ant-table {
                    margin: 0 !important;
                }
                .ant-table-expanded-row .ant-table-thead > tr > th {
                    background: #e8e8e8 !important;
                    fontWeight: bold;
                }
                .ant-table-expanded-row .ant-table-tbody > tr:hover > td {
                    background: #fafafa !important;
                }
                .ant-image {
                    position: static !important;
                }
                .ant-image .ant-image-mask {
                    position: static !important;
                }
                .ant-card-actions {
                    display: flex !important;
                    justify-content: center !important;
                    gap: 8px !important;
                    padding: 8px 0 !important;
                }
                .ant-card-actions > li {
                    margin: 0 !important;
                    width: auto !important;
                    text-align: center !important;
                }
                .ant-card-actions .ant-btn {
                    padding: 4px !important;
                    width: 32px !important;
                    height: 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                @media (max-width: 768px) {
                    .ant-card-actions {
                        gap: 4px !important;
                    }
                    .ant-card-actions .ant-btn {
                        width: 28px !important;
                        height: 28px !important;
                    }
                }
                /* 確保核實按鈕可點擊 */
                .ant-btn-circle {
                    pointer-events: auto !important;
                    opacity: 1 !important;
                }
            `}</style>
    </div>
  );
};

export default AuctionList;