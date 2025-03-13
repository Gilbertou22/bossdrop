import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Spin, Alert, Pagination, Row, Col, Popconfirm, Image, Checkbox, Card } from 'antd';
import { SearchOutlined, DeleteOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

const BASE_URL = 'http://localhost:5000';

const ManageItems = () => {
    const [items, setItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingItem, setEditingItem] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '', type: 'all' });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/items`, {
                params: {
                    search: filters.search || undefined,
                    type: filters.type === 'all' ? undefined : filters.type,
                },
            });
            console.log('Fetched items:', res.data);
            setItems(res.data);
            setFilteredItems(res.data);
        } catch (err) {
            console.error('Fetch items error:', err);
            message.error(err.response?.data?.msg || '載入物品失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchItems();
    };

    const handleCreateOrUpdate = async (values) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            if (editingItem) {
                await axios.put(`${BASE_URL}/api/items/${editingItem._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品更新成功');
            } else {
                await axios.post(`${BASE_URL}/api/items`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品創建成功');
            }
            fetchItems();
            setVisible(false);
            form.resetFields();
            setEditingItem(null);
        } catch (err) {
            console.error('Create/Update item error:', err);
            message.error(err.response?.data?.msg || '操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/items/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('物品刪除成功');
            fetchItems();
        } catch (err) {
            console.error('Delete item error:', err);
            message.error(err.response?.data?.msg || '刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        const token = localStorage.getItem('token');
        if (selectedRowKeys.length === 0) {
            message.warning('請至少選擇一個物品進行刪除');
            return;
        }
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/items/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success('批量刪除成功');
            fetchItems();
            setSelectedRowKeys([]);
        } catch (err) {
            console.error('Batch delete error:', err);
            message.error(err.response?.data?.msg || '批量刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => {
            setSelectedRowKeys(selectedKeys);
        },
    };

    const typeMapping = {
        equipment: '裝備',
        skill: '技能',
    };

    const columns = [
        {
            title: '圖片',
            dataIndex: 'imageUrl',
            key: 'imageUrl',
            render: (imageUrl) => (
                <Image
                    src={imageUrl || 'https://via.placeholder.com/50'}
                    alt=""
                    width={50}
                    height={50}
                    style={{ objectFit: 'cover' }}
                />
            ),
            width: 80,
        },
        { title: '名稱', dataIndex: 'name', key: 'name', width: 150 },
        {
            title: '類型',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (type) => typeMapping[type] || '未設置', // 映射為中文
        },
        { title: '描述', dataIndex: 'description', key: 'description', width: 200 },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Row gutter={[8, 8]} justify="center">
                    <Col>
                        <Button
                            onClick={() => {
                                setEditingItem(record);
                                setVisible(true);
                                form.setFieldsValue(record);
                            }}
                            disabled={loading}
                            type="primary"
                            shape="round"
                            size="small"
                            icon={<EditOutlined />}
                            style={{ background: '#1890ff', color: '#fff', borderColor: '#1890ff' }}
                        >
                            編輯
                        </Button>
                    </Col>
                    <Col>
                        <Popconfirm
                            title="確認刪除此物品？"
                            onConfirm={() => handleDelete(record._id)}
                            okText="是"
                            cancelText="否"
                            disabled={loading}
                        >
                            <Button
                                danger
                                disabled={loading}
                                shape="round"
                                size="small"
                                icon={<DeleteOutlined />}
                                style={{ background: '#ff4d4f', color: '#fff', borderColor: '#ff4d4f' }}
                            >
                                刪除
                            </Button>
                        </Popconfirm>
                    </Col>
                </Row>
            ),
            width: 150,
        },
    ];

    const paginatedItems = filteredItems.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>物品管理</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <Input.Search
                        placeholder="搜索物品名稱或描述"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        onSearch={handleSearch}
                        style={{ width: 200 }}
                        enterButton={<SearchOutlined />}
                    />
                    <Select
                        value={filters.type}
                        onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
                        style={{ width: 200 }}
                        onSelect={handleSearch}
                    >
                        <Option value="all">全部類型</Option>
                        <Option value="equipment">裝備</Option>
                        <Option value="skill">技能</Option>
                    </Select>
                    <Button
                        type="primary"
                        onClick={() => setVisible(true)}
                        style={{ marginLeft: 'auto' }}
                        disabled={loading}
                    >
                        新增物品
                    </Button>
                    <Popconfirm
                        title="確認批量刪除選中物品？"
                        onConfirm={handleBatchDelete}
                        okText="是"
                        cancelText="否"
                        disabled={loading || selectedRowKeys.length === 0}
                    >
                        <Button
                            type="danger"
                            icon={<DeleteOutlined />}
                            disabled={loading || selectedRowKeys.length === 0}
                        >
                            批量刪除
                        </Button>
                    </Popconfirm>
                </div>
                <Spin spinning={loading} size="large">
                    {filteredItems.length === 0 && !loading ? (
                        <Alert
                            message="無物品"
                            description="目前沒有符合條件的物品記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <Table
                                rowSelection={rowSelection}
                                dataSource={paginatedItems}
                                columns={columns}
                                rowKey="_id"
                                bordered
                                pagination={false}
                                scroll={{ x: 'max-content' }}
                            />
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={filteredItems.length}
                                onChange={setCurrentPage}
                                onShowSizeChange={(current, size) => {
                                    setCurrentPage(1);
                                    setPageSize(size);
                                }}
                                style={{ marginTop: '16px', textAlign: 'right' }}
                                showSizeChanger
                                pageSizeOptions={['10', '20', '50']}
                            />
                        </>
                    )}
                </Spin>
            </Card>
            <Modal
                title={editingItem ? '編輯物品' : '新增物品'}
                open={visible}
                onCancel={() => {
                    setVisible(false);
                    setEditingItem(null);
                    form.resetFields();
                }}
                footer={null}
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item
                        name="name"
                        label="名稱"
                        rules={[
                            { required: true, message: '請輸入物品名稱！' },
                            { min: 2, message: '名稱至少需要 2 個字符' },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="type"
                        label="類型"
                        rules={[{ required: true, message: '請選擇物品類型！' }]}
                    >
                        <Select>
                            <Option value="equipment">裝備</Option>
                            <Option value="skill">技能</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="描述"
                        rules={[{ max: 500, message: '描述不得超過 500 個字符' }]}
                    >
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item
                        name="imageUrl"
                        label="圖片 URL"
                        rules={[{ type: 'url', message: '請輸入有效的 URL 地址' }]}
                    >
                        <Input placeholder="輸入圖片 URL（可選）" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            提交
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageItems;