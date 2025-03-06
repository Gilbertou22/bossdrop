import React, { useState } from 'react';
import { Table, Button, Modal, Input, message } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

const AuctionList = ({ auctions, fetchAuctions }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

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
      title: '截止時間',
      dataIndex: 'endTime',
      key: 'endTime',
      render: (time) => (time ? moment(time).format('YYYY-MM-DD HH:mm:ss') : '無截止時間'),
    },
    {
      title: '創建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      render: (user) => user?.character_name || '未知',
    },
    {
      title: '最高出價者',
      dataIndex: 'highestBidder',
      key: 'highestBidder',
      render: (user) => user?.character_name || '無',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          onClick={() => handleBidClick(record)}
          disabled={!record.status || record.status !== 'active'}
        >
          出價
        </Button>
      ),
    },
  ];

  const handleBidClick = (auction) => {
    setSelectedAuction(auction);
    setIsModalVisible(true);
  };

  const handleBidSubmit = async () => {
    if (!bidAmount || isNaN(bidAmount) || parseInt(bidAmount) <= (selectedAuction?.currentPrice || 0)) {
      message.error('出價必須大於當前價格並為有效數字！');
      return;
    }

    try {
      await axios.post(
        `http://localhost:5000/api/auctions/${selectedAuction._id}/bid`,
        { amount: parseInt(bidAmount) },
        { headers: { 'x-auth-token': token } }
      );
      message.success('出價成功！');
      setIsModalVisible(false);
      setBidAmount('');
      fetchAuctions();
    } catch (err) {
      console.error('Bid error:', err);
      message.error(`出價失敗: ${err.response?.data?.msg || err.message}`);
    }
  };

  return (
    <div>
      <Table
        dataSource={auctions}
        columns={columns}
        rowKey="_id"
        pagination={{ pageSize: 5 }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '暫無數據' }}
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
        <Input
          type="number"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder="輸入出價金額"
          min={selectedAuction?.currentPrice + 1 || 1}
          style={{ margin: '10px 0' }}
        />
      </Modal>
    </div>
  );
};

export default AuctionList;