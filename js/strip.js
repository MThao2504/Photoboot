document.addEventListener('DOMContentLoaded', () => {
    // Các phần tử DOM
    const camera = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const stripBtn = document.getElementById('strip-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const downloadBtn = document.getElementById('download-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const frameButtons = document.querySelectorAll('.frame-btn');
    const borderButtons = document.querySelectorAll('.border-btn');
    const aspectButtons = document.querySelectorAll('.aspect-btn');
    const stripLayoutButtons = document.querySelectorAll('.strip-layout-btn');
    const stripColorButtons = document.querySelectorAll('.strip-color-btn');
    const photoStripContainer = document.querySelector('.photo-strip-container');
    const photoStrip = document.getElementById('photo-strip');
    const frameOverlay = document.getElementById('frame-overlay');
    const countdownTimer = document.getElementById('countdown-timer');
    
    // Biến lưu trữ stream camera và ngữ cảnh canvas
    let stream = null;
    const ctx = canvas.getContext('2d');
    let currentFilter = 'normal';
    let currentFrame = 'none';
    let currentBorder = 'none';
    let currentAspect = 'original';
    let currentStripLayout = '4x1';
    let currentStripColor = 'pink';
    
    // Biến để theo dõi trạng thái chụp ảnh
    let isCapturing = false;
    let isStripMode = false;
    let capturedPhotos = []; // Mảng lưu trữ các ảnh chụp trong chế độ strip
    let currentStripPhoto = 0; // Chỉ số của ảnh tiếp theo sẽ chụp
    
    // Biến lưu trữ requestAnimationFrame ID
    let animationFrameId = null;
    
    // Kích thước camera mặc định
    const width = 640;
    const height = 480;
    
    // Thiết lập kích thước canvas
    canvas.width = width;
    canvas.height = height;
    
    // Thông tin số ảnh cần chụp cho mỗi bố cục
    const layoutConfig = {
        '4x1': { count: 4, rows: 4, cols: 1 },
        '2x2': { count: 4, rows: 2, cols: 2 },
        '3x1': { count: 3, rows: 3, cols: 1 },
        '1x2': { count: 2, rows: 1, cols: 2 }
    };
    
    // Tỷ lệ khung hình
    const aspectRatios = {
        original: { width: 4, height: 3 },
        square: { width: 1, height: 1 },
        portrait: { width: 3, height: 4 },
        landscape: { width: 16, height: 9 },
        instagram: { width: 4, height: 5 },
        classic: { width: 3, height: 2 }
    };
    
    // Khởi động camera
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: width },
                    height: { ideal: height },
                    facingMode: 'user'
                },
                audio: false
            });
            
            camera.srcObject = stream;
            camera.style.display = 'block';
            photoStripContainer.style.display = 'none';
            
            // Áp dụng các hiệu ứng hiện tại cho camera
            applyAspectToCamera(currentAspect);
            applyFrameToCamera(currentFrame);
            applyBorderToCamera(currentBorder);
            
            // Bắt đầu vòng lặp hiển thị video với bộ lọc
            startVideoProcessing();
            
        } catch (err) {
            console.error('Lỗi khi truy cập camera:', err);
            alert('Không thể truy cập camera. Vui lòng cho phép truy cập camera và tải lại trang.');
        }
    }
    
    // Xử lý video theo thời gian thực để áp dụng bộ lọc
    function startVideoProcessing() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        function processFrame() {
            if (camera.readyState === camera.HAVE_ENOUGH_DATA && !isCapturing) {
                // Vẽ khung hình video lên canvas
                ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);
                
                // Áp dụng bộ lọc trong thời gian thực
                if (currentFilter !== 'normal') {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    applyFilterToImageData(imageData, currentFilter);
                    ctx.putImageData(imageData, 0, 0);
                }
            }
            
            // Tiếp tục vòng lặp
            animationFrameId = requestAnimationFrame(processFrame);
        }
        
        // Bắt đầu vòng lặp
        animationFrameId = requestAnimationFrame(processFrame);
    }
    
    // Dừng xử lý video
    function stopVideoProcessing() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    
    // Hiển thị đếm ngược
    function showCountdown(callback) {
        let count = 3;
        countdownTimer.textContent = count;
        countdownTimer.style.display = 'block';
        
        const interval = setInterval(() => {
            count--;
            
            if (count > 0) {
                countdownTimer.textContent = count;
            } else {
                clearInterval(interval);
                countdownTimer.style.display = 'none';
                callback();
            }
        }, 1000);
    }
    
    // Bắt đầu quá trình chụp dải ảnh
    function startPhotoStrip() {
        isStripMode = true;
        capturedPhotos = [];
        currentStripPhoto = 0;
        
        // Hiển thị đếm ngược và chụp ảnh đầu tiên
        showCountdown(() => captureStripPhoto());
    }
    
    // Chụp một ảnh trong dải ảnh
    function captureStripPhoto() {
        isCapturing = true;
        
        // Xác định kích thước cắt dựa trên tỷ lệ hiện tại
        const ratio = aspectRatios[currentAspect];
        let cropWidth, cropHeight, startX, startY;
        
        if (ratio.width / ratio.height > width / height) {
            // Cắt theo chiều dọc (height)
            cropHeight = (width * ratio.height) / ratio.width;
            cropWidth = width;
            startX = 0;
            startY = (height - cropHeight) / 2;
        } else {
            // Cắt theo chiều ngang (width)
            cropWidth = (height * ratio.width) / ratio.height;
            cropHeight = height;
            startX = (width - cropWidth) / 2;
            startY = 0;
        }
        
        // Vẽ khung hình hiện tại từ video lên canvas với vùng cắt
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(camera, startX, startY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        
        // Lưu trữ dữ liệu ảnh gốc
        const photoData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Áp dụng bộ lọc nếu có
        if (currentFilter !== 'normal') {
            applyFilterToImageData(photoData, currentFilter);
            ctx.putImageData(photoData, 0, 0);
        }
        
        // Lưu ảnh vào mảng
        capturedPhotos.push({
            imageUrl: canvas.toDataURL('image/png'),
            filter: currentFilter,
            frame: currentFrame,
            border: currentBorder,
            aspect: currentAspect
        });
        
        // Cập nhật chỉ số ảnh
        currentStripPhoto++;
        isCapturing = false;
        
        // Kiểm tra xem đã chụp đủ số ảnh chưa
        const requiredPhotos = layoutConfig[currentStripLayout].count;
        
        if (currentStripPhoto < requiredPhotos) {
            // Nếu chưa đủ, chụp tiếp
            setTimeout(() => {
                showCountdown(() => captureStripPhoto());
            }, 500);
        } else {
            // Nếu đã đủ, hiển thị kết quả
            displayPhotoStrip();
        }
    }
    
    // Hiển thị dải ảnh hoàn thiện
    function displayPhotoStrip() {
        // Dừng camera để tiết kiệm tài nguyên
        stopCamera();
        
        // Ẩn camera container
        camera.style.display = 'none';
        
        // Xóa nội dung dải ảnh cũ (nếu có)
        photoStrip.innerHTML = '';
        
        // Thêm class bố cục
        photoStrip.className = 'photo-strip layout-' + currentStripLayout;
        photoStrip.classList.add('strip-color-' + currentStripColor);
        
        // Thêm các ảnh vào dải ảnh
        capturedPhotos.forEach((photo, index) => {
            const img = document.createElement('img');
            img.src = photo.imageUrl;
            img.classList.add('strip-photo');
            img.classList.add('aspect-' + photo.aspect);
            
            if (photo.frame !== 'none') {
                img.classList.add('frame-' + photo.frame);
            }
            
            if (photo.border !== 'none') {
                img.classList.add('border-' + photo.border);
            }
            
            photoStrip.appendChild(img);
        });
        
        // Thêm thông tin ngày chụp
        const dateInfo = document.createElement('div');
        dateInfo.className = 'strip-date';
        dateInfo.textContent = new Date().toLocaleDateString('vi-VN');
        photoStrip.appendChild(dateInfo);
        
        // Thêm thông tin footer
        const footer = document.createElement('div');
        footer.className = 'strip-footer';
        footer.textContent = 'FotoLab';
        photoStrip.appendChild(footer);
        
        // Hiển thị dải ảnh
        photoStripContainer.style.display = 'block';
        
        // Cập nhật trạng thái các nút
        stripBtn.disabled = true;
        retakeBtn.disabled = false;
        downloadBtn.disabled = false;
    }
    
    // Dừng camera
    function stopCamera() {
        stopVideoProcessing();
        
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }
    
    // Đặt lại hiệu ứng trên camera
    function resetCameraEffects() {
        camera.classList.remove('aspect-original', 'aspect-square', 'aspect-portrait', 'aspect-landscape', 'aspect-instagram', 'aspect-classic');
        camera.classList.remove('frame-simple', 'frame-double', 'frame-polaroid', 'frame-vintage', 'frame-hearts');
        camera.classList.remove('border-thin', 'border-thick', 'border-rounded', 'border-dotted', 'border-dashed');
    }
    
    // Áp dụng bộ lọc cho dữ liệu hình ảnh
    function applyFilterToImageData(imageData, filter) {
        const data = imageData.data;
        
        switch (filter) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    data[i] = avg;     // R
                    data[i + 1] = avg; // G
                    data[i + 2] = avg; // B
                }
                break;
                
            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
                
            case 'brightness':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] * 1.3);
                    data[i + 1] = Math.min(255, data[i + 1] * 1.3);
                    data[i + 2] = Math.min(255, data[i + 2] * 1.3);
                }
                break;
                
            case 'contrast':
                const factor = 25;
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, ((data[i] - 128) * factor / 100) + 128);
                    data[i + 1] = Math.min(255, ((data[i + 1] - 128) * factor / 100) + 128);
                    data[i + 2] = Math.min(255, ((data[i + 2] - 128) * factor / 100) + 128);
                }
                break;
                
            case 'normal':
            default:
                // Không cần áp dụng bộ lọc
                break;
        }
    }
    
    // Áp dụng tỷ lệ khung hình cho camera
    function applyAspectToCamera(aspect) {
        // Xóa tất cả các class tỷ lệ cũ
        camera.classList.remove('aspect-original', 'aspect-square', 'aspect-portrait', 'aspect-landscape', 'aspect-instagram', 'aspect-classic');
        
        // Thêm class tỷ lệ mới
        camera.classList.add('aspect-' + aspect);
    }
    
    // Áp dụng khung hình cho camera
    function applyFrameToCamera(frame) {
        // Xóa tất cả các class khung hình cũ
        camera.classList.remove('frame-simple', 'frame-double', 'frame-polaroid', 'frame-vintage', 'frame-hearts');
        
        // Thêm class khung hình mới nếu không phải 'none'
        if (frame !== 'none') {
            camera.classList.add('frame-' + frame);
        }
    }
    
    // Áp dụng viền cho camera
    function applyBorderToCamera(border) {
        // Xóa tất cả các class viền cũ
        camera.classList.remove('border-thin', 'border-thick', 'border-rounded', 'border-dotted', 'border-dashed');
        
        // Thêm class viền mới nếu không phải 'none'
        if (border !== 'none') {
            camera.classList.add('border-' + border);
        }
    }
    
    // Chụp lại ảnh
    function retakePhoto() {
        // Đặt lại biến theo dõi trạng thái
        isCapturing = false;
        isStripMode = false;
        capturedPhotos = [];
        currentStripPhoto = 0;
        
        // Xóa nội dung dải ảnh
        photoStrip.innerHTML = '';
        
        startCamera();
        
        // Cập nhật trạng thái các nút
        stripBtn.disabled = false;
        retakeBtn.disabled = true;
        downloadBtn.disabled = true;
        
        // Áp dụng lại các hiệu ứng đã chọn cho camera
        applyAspectToCamera(currentAspect);
        applyFrameToCamera(currentFrame);
        applyBorderToCamera(currentBorder);
    }
    
    // Tải ảnh về máy
    function downloadPhoto() {
        // Tạo canvas mới cho dải ảnh
        const stripCanvas = document.createElement('canvas');
        const stripCtx = stripCanvas.getContext('2d');
        
        // Lấy kích thước của photoStrip
        const stripWidth = photoStrip.offsetWidth;
        const stripHeight = photoStrip.offsetHeight;
        
        // Thiết lập kích thước canvas
        stripCanvas.width = stripWidth;
        stripCanvas.height = stripHeight;
        
        // Vẽ background
        stripCtx.fillStyle = getComputedStyle(photoStrip).backgroundColor;
        stripCtx.fillRect(0, 0, stripWidth, stripHeight);
        
        // Vẽ HTML của photoStrip lên canvas
        html2canvas(photoStrip).then(canvas => {
            // Tạo link tải xuống và thiết lập thuộc tính
            const link = document.createElement('a');
            link.download = 'photoboot_strip_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
    
    // Hàm trợ giúp chuyển đổi HTML thành canvas
    function html2canvas(element) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Đặt kích thước canvas bằng kích thước của element
            canvas.width = element.offsetWidth;
            canvas.height = element.offsetHeight;
            
            // Lấy style của element
            const style = getComputedStyle(element);
            
            // Vẽ background
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Vẽ tất cả các ảnh trong strip
            const images = element.querySelectorAll('img');
            let loadedImages = 0;
            
            if (images.length === 0) {
                resolve(canvas);
                return;
            }
            
            images.forEach((img, index) => {
                const imgObj = new Image();
                imgObj.crossOrigin = 'Anonymous';
                imgObj.src = img.src;
                
                imgObj.onload = () => {
                    // Lấy vị trí và kích thước của ảnh
                    const rect = img.getBoundingClientRect();
                    const imgStyle = getComputedStyle(img);
                    
                    // Tính toán vị trí của ảnh trong photoStrip
                    const offsetX = img.offsetLeft;
                    const offsetY = img.offsetTop;
                    
                    // Vẽ ảnh lên canvas
                    ctx.drawImage(imgObj, offsetX, offsetY, img.offsetWidth, img.offsetHeight);
                    
                    // Vẽ border nếu có
                    if (imgStyle.borderWidth !== '0px') {
                        ctx.strokeStyle = imgStyle.borderColor;
                        ctx.lineWidth = parseInt(imgStyle.borderWidth);
                        ctx.strokeRect(offsetX, offsetY, img.offsetWidth, img.offsetHeight);
                    }
                    
                    loadedImages++;
                    
                    if (loadedImages === images.length) {
                        // Vẽ các phần tử khác (date, footer)
                        const dateEl = element.querySelector('.strip-date');
                        if (dateEl) {
                            ctx.fillStyle = 'white';
                            ctx.font = '16px Courier New';
                            ctx.textAlign = 'center';
                            ctx.fillText(dateEl.textContent, canvas.width / 2, dateEl.offsetTop + 20);
                        }
                        
                        const footerEl = element.querySelector('.strip-footer');
                        if (footerEl) {
                            ctx.fillStyle = 'white';
                            ctx.font = 'bold 22px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText(footerEl.textContent, canvas.width / 2, footerEl.offsetTop + 25);
                        }
                        
                        resolve(canvas);
                    }
                };
                
                imgObj.onerror = () => {
                    loadedImages++;
                    if (loadedImages === images.length) {
                        resolve(canvas);
                    }
                };
            });
        });
    }
    
    // Xử lý sự kiện khi chọn bộ lọc
    function handleFilterSelection(e) {
        // Loại bỏ class active từ tất cả nút bộ lọc
        filterButtons.forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút được chọn
        e.target.classList.add('active');
        
        // Lưu bộ lọc hiện tại
        currentFilter = e.target.dataset.filter;
        
        // Bộ lọc sẽ tự động được áp dụng trong vòng lặp xử lý video
    }
    
    // Xử lý sự kiện khi chọn khung hình
    function handleFrameSelection(e) {
        // Loại bỏ class active từ tất cả nút khung hình
        frameButtons.forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút được chọn
        e.target.classList.add('active');
        
        // Lưu khung hình hiện tại
        currentFrame = e.target.dataset.frame;
        
        // Áp dụng khung hình mới cho camera
        applyFrameToCamera(currentFrame);
    }
    
    // Xử lý sự kiện khi chọn viền
    function handleBorderSelection(e) {
        // Loại bỏ class active từ tất cả nút viền
        borderButtons.forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút được chọn
        e.target.classList.add('active');
        
        // Lưu viền hiện tại
        currentBorder = e.target.dataset.border;
        
        // Áp dụng viền mới cho camera
        applyBorderToCamera(currentBorder);
    }
    
    // Xử lý sự kiện khi chọn tỷ lệ khung hình
    function handleAspectSelection(e) {
        // Loại bỏ class active từ tất cả nút tỷ lệ
        aspectButtons.forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút được chọn
        e.target.classList.add('active');
        
        // Lưu tỷ lệ hiện tại
        currentAspect = e.target.dataset.aspect;
        
        // Áp dụng tỷ lệ mới cho camera
        applyAspectToCamera(currentAspect);
    }
    
    // Xử lý sự kiện khi chọn bố cục dải ảnh
    function handleStripLayoutSelection(e) {
        // Loại bỏ class active từ tất cả nút bố cục
        stripLayoutButtons.forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút được chọn
        e.target.classList.add('active');
        
        // Lưu bố cục hiện tại
        currentStripLayout = e.target.dataset.layout;
    }
    
    // Xử lý sự kiện khi chọn màu viền dải ảnh
    function handleStripColorSelection(e) {
        // Loại bỏ class active từ tất cả nút màu viền
        stripColorButtons.forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút được chọn
        e.target.classList.add('active');
        
        // Lưu màu viền hiện tại
        currentStripColor = e.target.dataset.color;
    }
    
    // Đăng ký các sự kiện
    stripBtn.addEventListener('click', startPhotoStrip);
    retakeBtn.addEventListener('click', retakePhoto);
    downloadBtn.addEventListener('click', downloadPhoto);
    
    // Đăng ký sự kiện cho các nút bộ lọc
    filterButtons.forEach(btn => {
        btn.addEventListener('click', handleFilterSelection);
        
        // Đặt nút 'Bình thường' là active mặc định
        if (btn.dataset.filter === 'normal') {
            btn.classList.add('active');
        }
    });
    
    // Đăng ký sự kiện cho các nút khung hình
    frameButtons.forEach(btn => {
        btn.addEventListener('click', handleFrameSelection);
    });
    
    // Đăng ký sự kiện cho các nút viền
    borderButtons.forEach(btn => {
        btn.addEventListener('click', handleBorderSelection);
    });
    
    // Đăng ký sự kiện cho các nút tỷ lệ khung hình
    aspectButtons.forEach(btn => {
        btn.addEventListener('click', handleAspectSelection);
    });
    
    // Đăng ký sự kiện cho các nút bố cục dải ảnh
    stripLayoutButtons.forEach(btn => {
        btn.addEventListener('click', handleStripLayoutSelection);
    });
    
    // Đăng ký sự kiện cho các nút màu viền dải ảnh
    stripColorButtons.forEach(btn => {
        btn.addEventListener('click', handleStripColorSelection);
    });
    
    // Khởi động camera khi trang tải xong
    startCamera();
    
    // Xử lý khi người dùng rời khỏi trang
    window.addEventListener('beforeunload', () => {
        stopVideoProcessing();
        stopCamera();
    });
}); 