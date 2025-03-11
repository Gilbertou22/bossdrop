import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Input, Tag, Avatar, Tooltip, Popconfirm, message } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import 'moment/locale/zh-tw';
moment.locale('zh-tw');

const BASE_URL = 'http://localhost:5000';

const statusMap = {
  active: '活躍',
  pending: '待處理',
  completed: '已結算',
  cancelled: '已取消',
  unknown: '未知',
};

const AuctionList = ({ auctions, fetchAuctions, userRole, handleSettleAuction }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bids, setBids] = useState({});
  const [userDiamonds, setUserDiamonds] = useState(0);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchUserInfo();
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/users/me`, {
        headers: { 'x-auth-token': token },
      });
      setUserDiamonds(res.data.diamonds || 0);
    } catch (err) {
      console.error('Fetch user info error:', err);
      message.error('無法獲取用戶信息，請重新登錄');
      navigate('/login');
    }
  };

  const fetchBids = async (auctionId) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/auctions/${auctionId}/bids`, {
        headers: { 'x-auth-token': token },
      });
      console.log(`Fetched bids for auction ${auctionId}:`, res.data);
      setBids(prev => ({ ...prev, [auctionId]: res.data }));
    } catch (err) {
      console.error(`Error fetching bids for auction ${auctionId}:`, err.response?.data || err);
      message.error('無法獲取出價歷史，請刷新頁面後重試！');
      setBids(prev => ({ ...prev, [auctionId]: [] }));
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
        text = '待處理（餘額不足）';
        break;
      case 'completed':
        color = 'blue';
        text = '已結算';
        break;
      case 'cancelled':
        color = 'red';
        text = '已取消';
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

  const columns = [
    {
      title: '競標 ID',
      dataIndex: '_id',
      key: '_id',
    },
    {
      title: '物品',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (name) => name || '未知物品',
    },
    {
      title: '起標價格',
      dataIndex: 'startingPrice',
      key: 'startingPrice',
      render: (price) => `${price || 0} 鑽石`,
    },
    {
      title: '當前價格',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      render: (price) => `${price || 0} 鑽石`,
    },
    {
      title: '直接得標價',
      dataIndex: 'buyoutPrice',
      key: 'buyoutPrice',
      render: (price) => (price ? `${price} 鑽石` : '無'),
    },
    {
      title: '截止時間',
      dataIndex: 'endTime',
      key: 'endTime',
      render: (time) => (time ? moment(time).format('YYYY-MM-DD HH:mm:ss') : '無截止時間'),
    },
    {
      title: '剩餘時間',
      dataIndex: 'endTime',
      key: 'remainingTime',
      render: (time) => {
        if (!time) return '無截止時間';
        const now = moment();
        const duration = moment(time).diff(now);
        if (duration <= 0) return '已結束';
        const durationMoment = moment.duration(duration);
        return `${Math.floor(durationMoment.asHours())}小時${durationMoment.minutes()}分`;
      },
    },
    {
      title: '最高出價者',
      dataIndex: 'highestBidder',
      key: 'highestBidder',
      render: (user) => user?.character_name || '無',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            type="primary"
            onClick={() => handleBidClick(record)}
            disabled={record.status !== 'active'}
          >
            出價
          </Button>
          {userRole === 'admin' && record.status !== 'completed' && (
            <Popconfirm
              title="確認結算此拍賣？"
              onConfirm={() => handleSettleAuction(record._id)}
              okText="是"
              cancelText="否"
            >
              <Button type="default">結算</Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  const bidColumns = [
    {
      title: '出價者',
      dataIndex: 'userId',
      key: 'userId',
      render: (user) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {user?.avatar ? (
            <Avatar src={user.avatar} size={32} style={{ marginRight: 8 }} />
          ) : (
            <Avatar style={{ backgroundColor: '#f56a00', marginRight: 8 }}>
              {user?.character_name?.[0] || 'U'}
            </Avatar>
          )}
          <span>{user?.character_name || '未知用戶'}</span>
        </div>
      ),
    },
    {
      title: '出價金額',
      dataIndex: 'amount',
      key: 'amount',
      sorter: (a, b) => a.amount - b.amount,
      render: (amount, record, index) => {
        const isHighestBid = index === 0;
        return (
          <span style={{ color: isHighestBid ? '#52c41a' : '#000', fontWeight: isHighestBid ? 'bold' : 'normal' }}>
            {amount} 鑽石
          </span>
        );
      },
    },
    {
      title: '出價時間',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => moment(a.created_at).unix() - moment(b.created_at).unix(),
      render: (time) => (
        <Tooltip title={moment(time).format('YYYY-MM-DD HH:mm:ss')}>
          {moment(time).fromNow()}
        </Tooltip>
      ),
    },
  ];

  const handleBidClick = (auction) => {
    console.log('Selected auction for bidding:', auction);
    if (!auction || !auction._id) {
      message.error('無法找到拍賣信息，請刷新頁面！');
      return;
    }
    setSelectedAuction(auction);
    setIsModalVisible(true);
  };

  const handleBidSubmit = async () => {
    if (!bidAmount) {
      message.error('請輸入出價金額！');
      return;
    }
    if (isNaN(bidAmount) || parseInt(bidAmount) <= 0) {
      message.error('出價金額必須為正整數！');
      return;
    }

    const bidValue = parseInt(bidAmount);
    const currentPrice = selectedAuction?.currentPrice || 0;

    if (bidValue === currentPrice) {
      message.error(`出價金額不能等於當前價格 ${currentPrice} 鑽石，請輸入更高的金額！`);
      return;
    }
    if (bidValue < currentPrice) {
      message.error(`出價金額必須大於當前價格 ${currentPrice} 鑽石！`);
      return;
    }

    try {
      console.log('Checking auction status before bidding:', selectedAuction._id);
      const resCheck = await axios.get(`${BASE_URL}/api/auctions/${selectedAuction._id}`, {
        headers: { 'x-auth-token': token },
      });
      const latestAuction = resCheck.data;
      if (!latestAuction) {
        throw new Error('拍賣不存在');
      }
      if (latestAuction.status !== 'active') {
        message.error(`拍賣已結束或被取消，當前狀態為 ${statusMap[latestAuction.status] || latestAuction.status}，無法出價。請刷新頁面後重試。`);
        return;
      }

      console.log('Sending bid request:', {
        auctionId: selectedAuction._id,
        amount: bidAmount,
        token: token,
      });

      const res = await axios.post(
        `${BASE_URL}/api/auctions/${selectedAuction._id}/bid`,
        { amount: bidValue },
        { headers: { 'x-auth-token': token } }
      );

      console.log('Bid response:', res.data);
      const buyoutTriggered = selectedAuction.buyoutPrice && bidValue >= selectedAuction.buyoutPrice;
      message.success(buyoutTriggered ? '出價成功，已直接得標！競標已結束。' : `出價成功！您已出價 ${bidValue} 鑽石，請確保結算前餘額足夠（當前餘額：${userDiamonds} 鑽石）。`);
      setIsModalVisible(false);
      setBidAmount('');
      fetchAuctions();
      fetchBids(selectedAuction._id);
    } catch (err) {
      console.error('Bid error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

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
            message.error(`出價失敗：${errorMsg}${detail ? `（${detail}）` : ''}`);
            break;
        }
      } else if (err.request) {
        message.error('網絡錯誤，請檢查您的網絡連線！');
      } else {
        message.error(`出價失敗：${err.message}`);
      }
    }
  };

  return (
    <div>
      <p>您的鑽石餘額：{userDiamonds} 鑽石</p>
      <Table
        dataSource={auctions}
        columns={columns}
        rowKey="_id"
        pagination={{ pageSize: 5 }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '暫無數據' }}
        expandable={{
          expandedRowRender: (record) => {
            const auctionBids = bids[record._id] || [];
            return (
              <Table
                columns={bidColumns}
                dataSource={auctionBids}
                rowKey="_id"
                pagination={false}
                locale={{ emptyText: '暫無出價記錄' }}
                style={{
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  padding: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
                rowClassName={(record, index) =>
                  index === 0 ? 'highest-bid-row' : ''
                }
              />
            );
          },
          onExpand: (expanded, record) => {
            if (expanded && !bids[record._id]) {
              fetchBids(record._id);
            }
          },
        }}
      />
      <Modal
        title={`為 ${selectedAuction?.itemName || '未知物品'} 出價`}
        visible={isModalVisible}
        onOk={handleBidSubmit}
        onCancel={() => {
          setIsModalVisible(false);
          setBidAmount('');
        }}
        okText="提交出價"
        cancelText="取消"
      >
        <p>當前價格: {selectedAuction?.currentPrice || 0} 鑽石</p>
        {selectedAuction?.buyoutPrice && (
          <p>直接得標價: {selectedAuction.buyoutPrice} 鑽石</p>
        )}
        <Input
          type="number"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder="輸入出價金額"
          min={(selectedAuction?.currentPrice || 0) + 1}
          style={{ margin: '10px 0' }}
        />
        {bidAmount && parseInt(bidAmount) > userDiamonds && (
          <p style={{ color: 'red' }}>
            警告：您的餘額（{userDiamonds} 鑽石）低於出價金額（{bidAmount} 鑽石），請確保結算前充值！
          </p>
        )}
        <p>注意：出價後，鑽石將在結算時扣除。您的餘額：{userDiamonds} 鑽石</p>
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
                    font-weight: bold;
                }
                .ant-table-expanded-row .ant-table-tbody > tr:hover > td {
                    background: #fafafa !important;
                }
            `}</style>
    </div>
  );
};

export default AuctionList;