#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>



static bool traverse(struct TreeNode *node, int *k, int *val)
{
    if (node == NULL) {
        return false;
    }
    if (traverse(node->left, k, val)) {
        return true;
    }
    if (--*k == 0) {
        *val = node->val;
        return true;
    }
    if (traverse(node->right, k, val)) {
        return true;
    }
    return false;
}

static int kthSmallest(struct TreeNode* root, int k)
{
    int value = 0;
    traverse(root, &k, &value);
    return value;
}
