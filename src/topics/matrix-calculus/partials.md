---
title: 标量对向量：偏导数与梯度
description: 编辑器原型。内容取自《深度学习中的矩阵微积分》的“标量对向量”一节，格式是 Markdown 加公式和指令块。
eyebrow: Deep Learning · Matrix Calculus · 编辑器原型
theme: rust
runtimeMath: true
numbered: false
toc: false
---

## 标量对向量

前面讨论的函数只有一个输入，例如 $y = f(x)$。但神经网络中的一个输出通常同时依赖许多量。例如 LM head 的一个 logit：

$$
z_j = \sum_{k=1}^{d} x_k W_{kj}
$$

$z_j$ 同时依赖 $x_1, \ldots, x_d$ 和 $W_{1j}, \ldots, W_{dj}$。如果我们只想知道其中某一个量变化时 $z_j$ 如何变化，就需要在其他量保持不变的情况下对它求导。这就是偏导数。

我们先用一个只有两个输入的函数把这个概念讲清楚，再回到上面的 LM head。

### 偏导数

对多元函数，只改变其中一个自变量、保持其他自变量不变时得到的导数称为偏导数，通常用 $\partial$ 表示，写作 $\dfrac{\partial f}{\partial x}$，在 $(x_0, y_0)$ 处的值写作 $\left.\dfrac{\partial f}{\partial x}\right|_{(x_0,y_0)}$。

举个例子：设 $f(x, y) = 3x^2 y$ 有两个输入，可以沿 $x$ 方向改变，也可以沿 $y$。我们先只让一个输入变化。

:mark[固定 $y$，只让 $x$ 变化]。固定 $y = y_0$ 后，$x \mapsto f(x, y_0)$ 就成为一个关于 $x$ 的单变量函数，因此可以直接使用前面的一元求导规则。它的图像是一条单变量曲线 $z = f(x, y_0)$，这条曲线在 $x = x_0$ 处的切线斜率，就是 $x$ 变化时 $f$ 的变化率。

计算时把 $y$ 当作常数：

$$
\frac{\partial}{\partial x}\,3x^2y = 3y \cdot \frac{d}{dx}x^2 = 3y \cdot 2x = 6xy
$$

:mark[固定 $x$，只让 $y$ 变化]，得到 $f$ 对 $y$ 的偏导数：

$$
\frac{\partial}{\partial y}\,3x^2y = 3x^2 \cdot \frac{d}{dy}y = 3x^2
$$

所以，一个二元函数在同一点可以有两个不同的局部变化率 $\dfrac{\partial f}{\partial x}$ 和 $\dfrac{\partial f}{\partial y}$。前者描述沿 $x$ 方向移动时函数怎样变化，后者描述沿 $y$ 方向移动时函数怎样变化。如果函数有更多输入，道理完全一样。

:::gradient-figure{x0="1.2" y0="0.8"}
左边是 $f(x, y)$ 的取值，经过选定的位置 $(x_0, y_0)$ 的曲线是 $f$ 的等值线，曲线上每一点的 $f$ 都等于 $f(x_0, y_0)$。

绿色箭头：$\dfrac{\partial f}{\partial x}$；粉色箭头：$\dfrac{\partial f}{\partial y}$。紫色箭头是两者合成的向量。

右边两张图是过 $(x_0, y_0)$、分别固定 $y = y_0$ 和固定 $x = x_0$ 切出的两条单变量曲线，各带一条切线，两条切线的斜率就是两个偏导数。
:::

现在重新回到 LM head：

$$
z_j = \sum_{k=1}^{d} x_k W_{kj}
$$

展开就是

$$
z_j = x_1W_{1j} + x_2W_{2j} + \cdots + x_dW_{dj}
$$

假设只改变 $x_k$，其他 $x$ 和所有权重都保持不变。与 $x_k$ 有关的只有 $x_kW_{kj}$ 这一项，因此

$$
\frac{\partial z_j}{\partial x_k} = W_{kj}
$$

$x_k$ 增加一个很小的量时，它对 $z_j$ 的影响会被权重 $W_{kj}$ 缩放。同样，如果只改变权重 $W_{kj}$，其他变量保持不变：

$$
\frac{\partial z_j}{\partial W_{kj}} = x_k
$$

所以在线性层里，输入对输出的影响由权重决定，而权重对输出的影响由对应的输入决定。

例如 $z_j = x_1W_{1j} + x_2W_{2j} + x_3W_{3j}$，那么

$$
\frac{\partial z_j}{\partial x_1} = W_{1j},\qquad \frac{\partial z_j}{\partial x_2} = W_{2j},\qquad \frac{\partial z_j}{\partial x_3} = W_{3j}
$$

到这里，我们仍然是在一次研究一个标量输入。但实际反向传播不会只问 $\dfrac{\partial z_j}{\partial x_1}$ 是多少，它通常需要同时知道 $z_j$ 对整个输入向量 $\mathbf{x} = [\,x_1\ \ \cdots\ \ x_d\,]$ 的变化率。也就是说，我们想把 $\dfrac{\partial z_j}{\partial x_1}, \dfrac{\partial z_j}{\partial x_2}, \ldots, \dfrac{\partial z_j}{\partial x_d}$ 一次组织起来。这组偏导数组成的向量，就是下一节要讨论的梯度。

### 梯度

偏导数一次只描述一个输入分量变化时，函数如何变化。但训练模型时，参数通常会同时改变。我们还需要知道：当多个输入一起发生微小变化时，输出会怎样变化。

设 $f = f(x, y)$。当 $x, y$ 分别发生很小的变化 $dx, dy$ 时，$f$ 的一阶变化为

$$
df = \frac{\partial f}{\partial x}\,dx + \frac{\partial f}{\partial y}\,dy
$$

把两个输入写成行向量：

$$
\mathbf{x} = [\,x\ \ y\,]\qquad d\mathbf{x} = [\,dx\ \ dy\,]
$$

再把两个偏导数排成一个行向量：

$$
\nabla f = \frac{\partial f}{\partial \mathbf{x}} = \Big[\,\frac{\partial f}{\partial x}\quad \frac{\partial f}{\partial y}\,\Big]
$$

这个向量称为 $f$ 的梯度，记作 $\nabla f$ 或 $\dfrac{\partial f}{\partial \mathbf{x}}$，$\nabla$ 读作 nabla。于是全微分可以写成点积：

$$
df = \nabla f \cdot d\mathbf{x}
$$

例如前面的函数 $f(x, y) = 3x^2y$ 有 $\dfrac{\partial f}{\partial x} = 6xy$，$\dfrac{\partial f}{\partial y} = 3x^2$，因此

$$
\nabla f = [\,6xy\quad 3x^2\,]
$$

梯度把“:mark[每个输入分量分别如何影响 $f$]”收集到了一个向量中。而 $df = \nabla f \cdot d\mathbf{x}$ 进一步告诉我们：给定输入变化 $d\mathbf{x}$，可以直接由梯度算出 $f$ 的一阶变化。

梯度还有一个重要的几何意义。若沿等值线移动，那么 $f$ 不变，因此 $df = \nabla f \cdot d\mathbf{x} = 0$，所以:mark[梯度与等值线垂直]。另一方面，

$$
df = \|\nabla f\|\,\|d\mathbf{x}\|\cos\theta
$$

其中 $\theta$ 是梯度与移动方向之间的夹角。在移动距离 $\|d\mathbf{x}\|$ 固定时，$\theta = 0$ 时 $df$ 最大。因此，:mark[梯度指向函数局部增长最快的方向，负梯度则指向下降最快的方向]。

这一点正好对应模型训练。若标量 Loss 为 $L = L(\mathbf{w})$，其中 $\mathbf{w} = [\,w_1\ \ w_2\ \ \cdots\ \ w_n\,]$，那么

$$
\nabla_{\mathbf{w}}L = \frac{\partial L}{\partial \mathbf{w}} = \Big[\,\frac{\partial L}{\partial w_1}\quad \frac{\partial L}{\partial w_2}\quad \cdots\quad \frac{\partial L}{\partial w_n}\,\Big]
$$

梯度中的第 $i$ 个分量，就是参数 $w_i$ 发生微小变化时 Loss 的变化率。梯度下降沿负梯度方向更新参数：

$$
\mathbf{w} \leftarrow \mathbf{w} - \eta\,\nabla_{\mathbf{w}}L
$$

这里先把参数写成向量只是为了方便说明。实际的 PyTorch 参数可以是任意维 Tensor；后面会看到，标量 Loss 对一个 Tensor 求导时，得到的梯度与这个 Tensor 具有相同的形状。
